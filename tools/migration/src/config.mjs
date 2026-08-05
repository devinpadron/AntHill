/*
 * Migration configuration that cannot be derived from the data.
 */

/*
 * v1 has no timezone field, and a handful of event times are stored as a bare
 * time of day ("17:30") which cannot become an instant without a zone.
 *
 * Confirmed by the operator: all companies are US Eastern.
 *
 * Deliberately "America/New_York" rather than a fixed-offset "EST". Literal EST
 * is UTC-5 all year; the profile found these bare times in So Bridal Social,
 * whose events run across summer dates, so a fixed offset would shift every
 * warm-weather event by an hour. The IANA zone applies EST/EDT per date.
 */
export const DEFAULT_TIME_ZONE = "America/New_York";

/** Per-company overrides, should a company ever operate elsewhere. */
export const COMPANY_TIME_ZONES = {};

export const timeZoneFor = (companyId) =>
	COMPANY_TIME_ZONES[companyId] ?? DEFAULT_TIME_ZONE;
