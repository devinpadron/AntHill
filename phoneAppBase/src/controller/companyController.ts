import db from "../../firebaseConfig";

interface Company {
    accessCode: string;
}

export default class CompanyController {
    public compareAccessCode = async (accessCode:string) => {
        try {
            //Retrieve event data
            const companyEntry = await db.collection("Companies").where('accessCode', '==', accessCode).get();
            if(!companyEntry.empty){
                companyEntry.forEach((doc) => {
                    return doc.id;
                })
            }
            return null
          } catch (e) {
            console.log("Error getting company", e);
          }
    };
};