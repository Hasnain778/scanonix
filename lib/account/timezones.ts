function buildTimezoneOptions(): { value: string; label: string }[] {
  const zones =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
          "timeZone",
        )
      : [
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "America/New_York",
          "America/Chicago",
          "America/Denver",
          "America/Los_Angeles",
          "America/Toronto",
          "Asia/Singapore",
          "Asia/Tokyo",
          "Asia/Kolkata",
          "Australia/Sydney",
        ];

  return [
    { value: "", label: "Select time zone" },
    ...zones.map((zone) => ({
      value: zone,
      label: zone.replace(/_/g, " "),
    })),
  ];
}

export const TIMEZONE_OPTIONS = buildTimezoneOptions();
