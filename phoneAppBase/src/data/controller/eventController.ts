import Event from '../class/eventClass'
import db from '../../../firebaseConfig';

class EventControllerStruct {
  public getEvent = async (eventID:string) => {
    try {
      //Retrieve event data
      const eventEntry = await db.collection('events').doc(eventID).get();
      if (eventEntry.exists) {
        const dbData = eventEntry.data();
        if (dbData) {
          const foundEvent = new Event;
          foundEvent.setEventID(eventID);
          foundEvent.setTitle(dbData.title);
          foundEvent.setDate(dbData.date);
          foundEvent.setHour(dbData.hour);
          foundEvent.setDuration(dbData.duration);
          foundEvent.setCompany(dbData.company);
          foundEvent.setJSON(dbData.jsonData);
          return foundEvent;
        } else {
        console.log("Document exists but data is undefined");
        return null
        }
      } else {
        console.log("No such document")
      }
    } catch (e) {
      console.log("Error getting event", e);
    }
  }

  private isValidDateFormat(date: string): boolean {
    const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateFormatRegex.test(date)) return false;
    
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }


  //eventually also gotta get events using user and company
  public getEventsByDate = async (date: string): Promise<Event[]> => {
    if (!this.isValidDateFormat(date)) {
      throw new Error("Invalid date format. Please use YYYY-MM-DD.");
    }

    try {
      const res: Event[] = [];
      const eventsSnapshot = await db.collection('events').where('date', '==', date).get();
      for (const doc of eventsSnapshot.docs) {
        const eventData = await this.getEvent(doc.id);
        if (eventData) {
          res.push(eventData);
        }
      }
      return res;
    } catch (e) {
      console.error(`Failed to get events for ${date}:`, e);
      throw e;
    }
  }


  public addEvent = async (newEvent:Event) => {
    const eventData = {
      title: newEvent.getTitle(),
      date: newEvent.getDate(),
      hour: newEvent.getHour(),
      duration: newEvent.getDuration(),
      company: newEvent.getCompany(),
      jsonData: newEvent.getJSON(),
    };
    try {
      const entry = await db.collection('events').add(eventData);
      const entryid = entry.id;
      newEvent.setEventID(entryid)
      return entryid;
    } catch (e) {
      console.error("Error adding event:", e);
      throw e;
    }
  }
  
  public deleteEvent = async (eventID:string) => {
    // Delete an existing user
    try {
      await db.collection('events').doc(eventID).delete();
      console.log("Event successfully deleted");
      return true;
    } catch (e) {
      console.error("Error deleting event:", e);
      throw e;
    }
  }
  
  public updateEvent = async (eventID: string, eventData: object) => {
    try {
      await db.collection('events').doc(eventID).update(eventData);
      console.log("Event successfully updated");
      return true;
    } catch (e) {
      console.error("Error updating event:", e);
      throw e;
    }
  };
}
    
const EventController = new EventControllerStruct;
  
export default EventController;