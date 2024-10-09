import { db } from "../../../config";
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import Event from '../class/eventClass'

class EventControllerStruct {
  
    public getEvent = async (eventID:string) => {
      // Retrieve event data
      const docSnap = await getDoc(doc(db, "events", eventID));
      if (docSnap.exists()) {
        const dbEvent = docSnap.data()
        const foundEvent = new Event
        foundEvent.setEventID(eventID)
        foundEvent.setTitle(dbEvent.title)
        foundEvent.setDate(dbEvent.date)
        foundEvent.setHour(dbEvent.hour)
        foundEvent.setDuration(dbEvent.duration)
        foundEvent.setCompany(dbEvent.company)
        foundEvent.setJSON(dbEvent.jsonData)
        return foundEvent;
      } else {
        console.log("No such document")
        return null
      }
    }
  
    public deleteEvent = async (eventID:string) => {
      // Delete an existing user
      await deleteDoc(doc(db, "events", eventID))
    }
  
    public setEvent = async (newEvent:Event) => {
      // Create a new user or update existing
      const data = {
        title: newEvent.getTitle(),
        date: newEvent.getDate(),
        hour: newEvent.getHour(),
        duration: newEvent.getDuration(),
        company: newEvent.getCompany(),
        jsonData: newEvent.getJSON()
      }
      await setDoc(doc(db, 'events', newEvent.getEventID()), data);
    }
    
  }
  
  const EventController = new EventControllerStruct;
  
  export default EventController;