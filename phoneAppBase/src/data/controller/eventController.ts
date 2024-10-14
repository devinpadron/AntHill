import { testdb } from "../../../firebaseConfig";
import { doc, setDoc, deleteDoc, getDoc, collection , addDoc, updateDoc } from 'firebase/firestore'
import Event from '../class/eventClass'

class EventControllerStruct {
  public getEvent = async (eventID:string) => {
    try {
      //Retrieve event data
      const eventEntry = await getDoc(doc(testdb, 'events' , eventID));
      if (eventEntry.exists()) {
        const dbData = eventEntry.data();
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
        console.log("No such document");
        return null
      }
    } catch (e) {
      console.log("Error getting event", e);
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
      }
      try {
        const entry = await addDoc(collection(testdb, 'events'), eventData);
        const entryid = entry.id;
  
        const eventWithId = {
          ...eventData,
          eventID: entryid
        };
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
        await deleteDoc(doc(testdb, 'events' , eventID));
        console.log("Event successfully deleted");
        return true;
      } catch (e) {
        console.error("Error deleting event:", e);
        throw e;
      }
    }
  
    public updateEvent = async (eventID: string, eventData: object) => {
      try {
        const userEntry = doc(testdb, 'events' , eventID);
        await updateDoc(userEntry, eventData);
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