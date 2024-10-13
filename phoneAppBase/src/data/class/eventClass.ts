

export default class Event {
    private eventID:string = ""// This is used for database storage
    private title:string = "" // This is the title displayed in the agenda
    private date:string = "" //In the form of "yyyy-MM-dd"
    private hour:string = "" //This is what will be displayed in the agenda view
    private duration:string = "" //This is also displayed in the agenda view
    private company:string = "" //To keep track of what company this is meant for
    private jsonData:string = "{}"

    public getEventID(){
        return this.eventID;
    }

    public setEventID(newEventID:string){
        this.eventID = newEventID;
    }

    public getTitle(){
        return this.title;
    }

    public setTitle(newTitle:string){
        this.title = newTitle;
    }

    public getDate(){
        return this.date;
    }

    public setDate(newDate:string){
        this.date = newDate;
    }

    public getHour(){
        return this.hour;
    }

    public setHour(newHour:string){
        this.hour = newHour;
    }

    public getDuration(){
        return this.duration;
    }

    public setDuration(newDuration:string){
        this.duration = newDuration;
    }

    public getCompany(){
        return this.company;
    }

    public setCompany(newCompany:string){
        this.company = newCompany;
    }

    public getJSON(){
        return this.jsonData
    }

    public setJSON(newJson:string){
        this.jsonData = newJson;
    }
}
