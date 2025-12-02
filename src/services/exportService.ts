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
	fileName: string,
	isExcel = false,
): Promise<string> => {
	try {
		// Create headers for main time entry
		let headers = [
			"Date",
			"Clock In",
			"Clock Out",
			"Duration",
			"Duration (hrs)",
			"Status",
			"Notes",
		];

		// Find all possible form fields from all entries (main and connected events)
		const mainFormFields = new Map();
		const eventFormFields = new Map();

		// Process all entries to collect unique form fields
		timeEntries.forEach((entry) => {
			// Process main entry form fields
			if (entry.generalForm && entry.generalForm.fields) {
				entry.generalForm.fields.forEach((field) => {
					mainFormFields.set(field.id, field);
				});
			}

			// Process connected events form fields
			if (entry.connectedEvents && entry.connectedEvents.length > 0) {
				entry.connectedEvents.forEach((connEvent) => {
					if (entry.eventForm && entry.eventForm.fields) {
						entry.eventForm.fields.forEach((field) => {
							eventFormFields.set(
								`${connEvent.eventId}_${field.id}`,
								{
									...field,
									eventId: connEvent.eventId,
									eventTitle: connEvent.eventTitle || "Event",
								},
							);
						});
					}
				});
			}
		});

		// Add main form field headers
		Array.from(mainFormFields.values()).forEach((field) => {
			headers.push(`Form: ${field.label}`);
		});

		// Add connected event headers
		Array.from(eventFormFields.values()).forEach((field) => {
			headers.push(`Event[${field.eventTitle}]: ${field.label}`);
		});

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

			// Add main form responses
			Array.from(mainFormFields.values()).forEach((field) => {
				let value = "N/A";

				if (
					entry.formResponses &&
					entry.formResponses[field.id] !== undefined
				) {
					const response = entry.formResponses[field.id];
					value = formatFieldValue(response, field.type);
				}

				row.push(value);
			});

			// Add connected event form responses
			Array.from(eventFormFields.values()).forEach((field) => {
				let value = "N/A";

				// Find the matching connected event
				if (entry.connectedEvents && entry.connectedEvents.length > 0) {
					const connEvent = entry.connectedEvents.find(
						(e) => e.eventId === field.eventId,
					);

					if (
						connEvent &&
						connEvent.formResponses &&
						connEvent.formResponses[field.id.split("_")[1]] !==
							undefined
					) {
						const response =
							connEvent.formResponses[field.id.split("_")[1]];
						value = formatFieldValue(response, field.type);
					}
				}

				row.push(value);
			});

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

// Helper function to format field values based on their type
const formatFieldValue = (response, fieldType) => {
	let value = "N/A";

	if (response === null || response === undefined) {
		return value;
	}

	if (fieldType === "checkbox") {
		value = response ? "Yes" : "No";
	} else if (fieldType === "multiSelect" && Array.isArray(response)) {
		value = response.join("; ");
	} else if (fieldType === "date" && response) {
		value = format(new Date(response), "yyyy-MM-dd");
	} else if (fieldType === "time" && response) {
		value = format(new Date(response), "HH:mm:ss");
	} else if (typeof response === "object") {
		value = JSON.stringify(response).replace(/,/g, ";");
	} else {
		value = String(response).replace(/,/g, ";").replace(/\n/g, " ");
	}

	return value;
};

/**
 * Export time entries to PDF format
 */
export const exportTimeEntriesToPDF = async (
	timeEntries: any[],
	employeeUser: any,
	companyId: string,
	fileName: string,
): Promise<string> => {
	try {
		// Get company information for header
		const company = await getCompanyById(companyId);

		// Start building HTML content with styles (keep existing styles)
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
            
            /* Additional styles for connected events */
            .connected-events {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #ccc;
            }
            .event-title {
              font-weight: bold;
              color: #0066cc;
              margin-bottom: 8px;
            }
            .event-details {
              margin-left: 15px;
              padding-left: 10px;
              border-left: 3px solid #eee;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${
				company?.name || "AntHill Company"
			}</div>
            <div class="report-title">Time Entry Report</div>
            <div>${format(new Date(), "MMMM d, yyyy")}</div>
          </div>
          
          <div class="summary">
            <div class="summary-row">
              <span class="summary-label">Employee:</span>
              <span>${employeeUser?.firstName || ""} ${
					employeeUser?.lastName || "Unknown"
				}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Entries:</span>
              <span>${timeEntries.length}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Hours:</span>
              <span>${(
					timeEntries.reduce(
						(sum, entry) => sum + (entry.duration || 0),
						0,
					) / 3600
				).toFixed(2)}</span>
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
											timeEntries[timeEntries.length - 1]
												.clockInTime,
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
			if (
				entry.generalForm &&
				entry.generalForm.fields &&
				entry.formResponses
			) {
				htmlContent += `<div class="responses-section"><h4>Time Entry Form Responses</h4>`;

				entry.generalForm.fields.forEach((field) => {
					if (entry.formResponses[field.id] !== undefined) {
						const response = entry.formResponses[field.id];
						let displayValue = formatPDFFieldValue(response, field);

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

			// Add connected events if available
			if (entry.connectedEvents && entry.connectedEvents.length > 0) {
				htmlContent += `<div class="connected-events"><h4>Connected Events</h4>`;

				entry.connectedEvents.forEach((connEvent) => {
					htmlContent += `
            <div class="event-title">${connEvent.eventTitle || "Event"}</div>
            <div class="event-details">
          `;

					// Add event form responses if available
					if (
						entry.eventForm &&
						entry.eventForm.fields &&
						connEvent.formResponses
					) {
						entry.eventForm.fields.forEach((field) => {
							if (
								connEvent.formResponses[field.id] !== undefined
							) {
								const response =
									connEvent.formResponses[field.id];
								let displayValue = formatPDFFieldValue(
									response,
									field,
								);

								htmlContent += `
                <div class="response-item">
                  <div class="response-label">${field.label}</div>
                  <div>${displayValue}</div>
                </div>
              `;
							}
						});
					} else {
						htmlContent += `<div>No form data available</div>`;
					}

					htmlContent += `</div>`;
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

// Helper function to format field values for PDF
const formatPDFFieldValue = (response, field) => {
	if (response === null || response === undefined) {
		return "N/A";
	}

	if (field.type === "checkbox") {
		return response ? "Yes" : "No";
	} else if (field.type === "multiSelect" && Array.isArray(response)) {
		return response.join(", ");
	} else if (field.type === "date" && response) {
		return format(new Date(response), "MMM d, yyyy");
	} else if (field.type === "time" && response) {
		return format(new Date(response), "h:mm a");
	} else if (
		field.type === "number" &&
		field.useMultiplier &&
		field.multiplier
	) {
		return `${response} (${(response * field.multiplier).toFixed(2)} ${
			field.unit || ""
		})`;
	} else if (typeof response === "string" && response.includes("\n")) {
		return response.replace(/\n/g, "<br>");
	} else {
		return String(response);
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
