import RNFS from "react-native-fs";
import { Share, Platform } from "react-native";
import { format } from "date-fns";
import RNHTMLtoPDF from "react-native-html-to-pdf";
import { getCompanyById } from "./companyService";
import { formatDuration } from "../utils/timeUtils";

/**
 * Export time entries to CSV format
 */
export const exportTimeEntriesToCSV = async (
	timeEntries: any[],
	customForm: any,
	employeeUser: any,
	fileName: string,
	isExcel = false,
): Promise<string> => {
	try {
		// Create headers
		let headers = [
			"Date",
			"Clock In",
			"Clock Out",
			"Duration",
			"Duration (hrs)",
			"Status",
			"Notes",
		];

		// Add form field headers if available
		if (customForm && customForm.fields) {
			customForm.fields.forEach((field) => {
				headers.push(field.label);
			});
		}

		// Create CSV content with headers
		let csvContent = headers.join(",") + "\n";

		// Add data rows
		timeEntries.forEach((entry) => {
			const clockInDate = format(
				new Date(entry.clockInTime),
				"yyyy-MM-dd",
			);
			const clockInTime = format(new Date(entry.clockInTime), "HH:mm:ss");
			const clockOutTime = entry.clockOutTime
				? format(new Date(entry.clockOutTime), "HH:mm:ss")
				: "N/A";
			const duration = formatDuration(entry.duration || 0);
			const durationHrs = entry.duration
				? (entry.duration / 3600).toFixed(2)
				: "0.00";
			const status = entry.status || "N/A";
			const notes = (entry.notes || "N/A")
				.replace(/,/g, ";")
				.replace(/\n/g, " "); // Escape commas and newlines

			// Start with standard fields
			let row = [
				clockInDate,
				clockInTime,
				clockOutTime,
				duration,
				durationHrs,
				status,
				notes,
			];

			// Add form responses if available
			if (customForm && customForm.fields) {
				customForm.fields.forEach((field) => {
					let value = "N/A";

					if (
						entry.formResponses &&
						entry.formResponses[field.id] !== undefined
					) {
						const response = entry.formResponses[field.id];

						if (field.type === "checkbox") {
							value = response ? "Yes" : "No";
						} else if (
							field.type === "multiSelect" &&
							Array.isArray(response)
						) {
							value = response.join("; ");
						} else if (field.type === "date" && response) {
							value = format(new Date(response), "yyyy-MM-dd");
						} else if (field.type === "time" && response) {
							value = format(new Date(response), "HH:mm:ss");
						} else if (typeof response === "object") {
							value = JSON.stringify(response).replace(/,/g, ";");
						} else if (
							response !== null &&
							response !== undefined
						) {
							value = String(response)
								.replace(/,/g, ";")
								.replace(/\n/g, " ");
						}
					}

					row.push(value);
				});
			}

			// Add row to CSV content
			csvContent += row.join(",") + "\n";
		});

		// Determine file extension
		const extension = isExcel ? ".xlsx" : ".csv";

		// Generate file path
		const path = `${RNFS.DocumentDirectoryPath}/${fileName}${extension}`;

		// Write file
		await RNFS.writeFile(path, csvContent, "utf8");

		return path;
	} catch (error) {
		console.error("Error exporting to CSV:", error);
		throw error;
	}
};

/**
 * Export time entries to PDF format
 */
export const exportTimeEntriesToPDF = async (
	timeEntries: any[],
	customForm: any,
	employeeUser: any,
	companyId: string,
	fileName: string,
): Promise<string> => {
	try {
		// Get company information for header
		const company = await getCompanyById(companyId);

		// Start building HTML content
		let htmlContent = `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px solid #eee;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .report-title {
              font-size: 18px;
              color: #666;
              margin-bottom: 5px;
            }
            .summary {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border-radius: 5px;
            }
            .summary-row {
              margin-bottom: 8px;
            }
            .summary-label {
              font-weight: bold;
              display: inline-block;
              width: 150px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #f0f7ff;
              text-align: left;
              padding: 10px;
              font-weight: bold;
              border-bottom: 2px solid #ddd;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #eee;
              vertical-align: top;
            }
            .entry-card {
              margin-bottom: 20px;
              padding: 15px;
              border: 1px solid #eee;
              border-radius: 5px;
            }
            .entry-header {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 1px solid #eee;
            }
            .entry-detail {
              margin-bottom: 5px;
            }
            .detail-label {
              font-weight: bold;
              display: inline-block;
              width: 100px;
            }
            .responses-section {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #eee;
            }
            .response-item {
              margin-bottom: 8px;
            }
            .response-label {
              font-weight: bold;
              font-size: 13px;
              color: #666;
            }
            .total-row {
              font-weight: bold;
              background-color: #f0f7ff;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${company?.name || "AntHill Company"}</div>
            <div class="report-title">Time Entry Report</div>
            <div>${format(new Date(), "MMMM d, yyyy")}</div>
          </div>
          
          <div class="summary">
            <div class="summary-row">
              <span class="summary-label">Employee:</span>
              <span>${employeeUser?.firstName || ""} ${employeeUser?.lastName || "Unknown"}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Entries:</span>
              <span>${timeEntries.length}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Hours:</span>
              <span>${(timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0) / 3600).toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Date Range:</span>
              <span>
                ${
					timeEntries.length > 0
						? format(
								new Date(timeEntries[0].clockInTime),
								"MMM d, yyyy",
							) +
							(timeEntries.length > 1
								? " to " +
									format(
										new Date(
											timeEntries[
												timeEntries.length - 1
											].clockInTime,
										),
										"MMM d, yyyy",
									)
								: "")
						: "N/A"
				}
              </span>
            </div>
          </div>
    `;

		// Add time entry details
		htmlContent += `<h3>Time Entry Details</h3>`;

		timeEntries.forEach((entry) => {
			const clockInDate = format(
				new Date(entry.clockInTime),
				"EEE, MMM d, yyyy",
			);
			const clockInTime = format(new Date(entry.clockInTime), "h:mm a");
			const clockOutTime = entry.clockOutTime
				? format(new Date(entry.clockOutTime), "h:mm a")
				: "N/A";
			const duration = formatDuration(entry.duration || 0);
			const durationHrs = entry.duration
				? (entry.duration / 3600).toFixed(2)
				: "0.00";
			const status = entry.status || "N/A";

			htmlContent += `
        <div class="entry-card">
          <div class="entry-header">${clockInDate}</div>
          
          <div class="entry-detail">
            <span class="detail-label">Clock In:</span>
            <span>${clockInTime}</span>
          </div>
          
          <div class="entry-detail">
            <span class="detail-label">Clock Out:</span>
            <span>${clockOutTime}</span>
          </div>
          
          <div class="entry-detail">
            <span class="detail-label">Duration:</span>
            <span>${duration} (${durationHrs} hrs)</span>
          </div>
          
          <div class="entry-detail">
            <span class="detail-label">Status:</span>
            <span>${status}</span>
          </div>
      `;

			// Add notes if available
			if (entry.notes) {
				htmlContent += `
          <div class="entry-detail">
            <span class="detail-label">Notes:</span>
            <span>${entry.notes.replace(/\n/g, "<br>")}</span>
          </div>
        `;
			}

			// Add form responses if available
			if (customForm && customForm.fields && entry.formResponses) {
				htmlContent += `<div class="responses-section"><h4>Form Responses</h4>`;

				customForm.fields.forEach((field) => {
					if (entry.formResponses[field.id] !== undefined) {
						const response = entry.formResponses[field.id];
						let displayValue = "N/A";

						if (field.type === "checkbox") {
							displayValue = response ? "Yes" : "No";
						} else if (
							field.type === "multiSelect" &&
							Array.isArray(response)
						) {
							displayValue = response.join(", ");
						} else if (field.type === "date" && response) {
							displayValue = format(
								new Date(response),
								"MMM d, yyyy",
							);
						} else if (field.type === "time" && response) {
							displayValue = format(new Date(response), "h:mm a");
						} else if (
							field.type === "number" &&
							field.useMultiplier &&
							field.multiplier
						) {
							displayValue = `${response} (${(response * field.multiplier).toFixed(2)} ${field.unit || ""})`;
						} else if (
							response !== null &&
							response !== undefined
						) {
							displayValue = String(response);
						}

						htmlContent += `
              <div class="response-item">
                <div class="response-label">${field.label}</div>
                <div>${displayValue}</div>
              </div>
            `;
					}
				});

				htmlContent += `</div>`;
			}

			htmlContent += `</div>`;
		});

		// Close HTML structure
		htmlContent += `
        </body>
      </html>
    `;

		// Generate PDF
		const options = {
			html: htmlContent,
			fileName: fileName,
			directory: "Documents",
			base64: false,
		};

		const file = await RNHTMLtoPDF.convert(options);
		return file.filePath;
	} catch (error) {
		console.error("Error exporting to PDF:", error);
		throw error;
	}
};

/**
 * Share a file using the native share dialog
 */
export const shareFile = async (filePath: string): Promise<void> => {
	try {
		// Get file URL based on platform
		const fileUrl = Platform.OS === "ios" ? filePath : `file://${filePath}`;

		// Determine file type based on extension
		const extension = filePath.split(".").pop()?.toLowerCase();
		let contentType = "application/octet-stream";

		if (extension === "csv") {
			contentType = "text/csv";
		} else if (extension === "pdf") {
			contentType = "application/pdf";
		} else if (extension === "xlsx") {
			contentType =
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		}

		// Share the file
		const result = await Share.share(
			{
				url: fileUrl,
				title: "Time Entry Export",
				message: "Here is your exported time entry data",
			},
			{
				dialogTitle: "Share Time Entry Export",
				subject: "Time Entry Export",
				tintColor: "#007AFF",
			},
		);

		if (result.action === Share.sharedAction) {
			if (result.activityType) {
				console.log(`Shared via ${result.activityType}`);
			} else {
				console.log("Shared successfully");
			}
		} else if (result.action === Share.dismissedAction) {
			console.log("Share was dismissed");
		}
	} catch (error) {
		console.error("Error sharing file:", error);
		throw error;
	}
};
