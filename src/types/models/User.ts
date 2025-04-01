export interface User {
	firstName: string;
	lastName: string;
	email: string;
	loggedInCompany: string;
	companies: {
		[companyId: string]: string;
	};
}
