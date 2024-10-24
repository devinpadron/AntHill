import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import db from '../../firebaseConfig';

interface Event{
  title:string      // This is the title displayed in the agenda
  date:string       //In the form of "yyyy-MM-dd"
  startTime:string  //This is what will be displayed in the agenda view
  endTime:string    //This is what will be displayed in the agenda view
  duration:string   //This is also displayed in the agenda view
  company:string    //To keep track of what company this is meant for
  //jsonData:string 
}

class EventControllerStruct {
  public getEvent = async (eventID:string) => {
    try {
      //Retrieve event data
      const eventEntry = await db.collection('events').doc(eventID).get();
      if (eventEntry.exists) {
        const dbData = eventEntry.data();
        if (dbData) {
          return dbData;
        } else {
          return null;
        }
      } else {
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

  public getEventsByDate = async (date: string): Promise<FirebaseFirestoreTypes.DocumentData[]> => {
    if (!this.isValidDateFormat(date)) {
      throw new Error("Invalid date format. Please use YYYY-MM-DD.");
    }
    try {
      const res: FirebaseFirestoreTypes.DocumentData[] = [];
      const eventsFromDB = await db.collection('events').where('date', '==', date).get();

      eventsFromDB.forEach(event => {
        const eventData = event.data() as Event;
        res.push(eventData);
      })
      
      return res;
    } catch (e) {
      console.error(`Failed to get events for ${date}:`);
      throw e;
    }
  }

    public addEvent = async (newEvent:Event) => {
      try {
        const entry = await db.collection('events').add(newEvent);
        const entryid = entry.id;
        return entryid;
      } catch (e) {
        console.error("Error adding event:", e);
        throw e;
      }
    }
  
    public deleteEvent = async (eventID:string) => {
      // Delete an existing event
      try {
        await db.collection('events').doc(eventID).delete();
        console.log("Event successfully deleted");
        return true;
      } catch (e) {
        console.error("Error deleting event:", e);
        throw e;
      }
    }
  
    public updateEvent = async (eventID: string, eventData: Event) => {
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