import Event from '../data/class/eventClass';
import EventController from '../data/controller/eventController';

async function createTestEvent(){
    const newEvent = new Event;
    newEvent.setTitle("testTitle");
    newEvent.setDate("2024-11-25");
    newEvent.setHour("13");
    newEvent.setDuration("12");
    newEvent.setCompany("testCompany");
    newEvent.setJSON("{}")
    await EventController.addEvent(newEvent);
}

export { createTestEvent }
