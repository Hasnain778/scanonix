import { StyleSheet } from "@react-pdf/renderer";

export const pdfColors = {
  orange: "#FF6A00",
  orangeLight: "#FF8533",
  black: "#121212",
  white: "#FFFFFF",
  grey100: "#F5F5F5",
  grey200: "#E5E5E5",
  grey400: "#A3A3A3",
  grey600: "#666666",
  grey800: "#333333",
  criticalBg: "#FEE2E2",
  criticalText: "#991B1B",
  highBg: "#FFEDD5",
  highText: "#C2410C",
  mediumBg: "#FEF3C7",
  mediumText: "#A16207",
  lowBg: "#ECFDF5",
  lowText: "#047857",
  infoBg: "#F3F4F6",
  infoText: "#374151",
};

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: pdfColors.white,
    color: pdfColors.black,
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 72,
    paddingBottom: 56,
    paddingHorizontal: 40,
    lineHeight: 1.45,
  },
  header: {
    position: "absolute",
    top: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.grey200,
    paddingBottom: 10,
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 24,
    height: 24,
    objectFit: "contain",
  },
  headerBrandText: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.orange,
    letterSpacing: 1,
  },
  headerMeta: {
    fontSize: 8,
    color: pdfColors.grey600,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: pdfColors.grey200,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: pdfColors.grey600,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: pdfColors.grey600,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.black,
    marginBottom: 8,
    marginTop: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: pdfColors.grey200,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    backgroundColor: pdfColors.grey100,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  metricBox: {
    flexGrow: 1,
    minWidth: "22%",
    borderWidth: 1,
    borderColor: pdfColors.grey200,
    borderRadius: 6,
    padding: 10,
    backgroundColor: pdfColors.white,
  },
  metricLabel: {
    fontSize: 8,
    color: pdfColors.grey600,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.black,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 120,
    fontSize: 9,
    color: pdfColors.grey600,
  },
  value: {
    flex: 1,
    fontSize: 9,
    color: pdfColors.black,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  findingCard: {
    borderWidth: 1,
    borderColor: pdfColors.grey200,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    backgroundColor: pdfColors.white,
  },
  findingTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: pdfColors.black,
  },
  findingBody: {
    fontSize: 9,
    color: pdfColors.grey800,
    marginBottom: 4,
  },
  bulletItem: {
    fontSize: 9,
    color: pdfColors.grey800,
    marginBottom: 4,
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  timelineLabel: {
    fontSize: 9,
    color: pdfColors.grey800,
  },
});

export function getSeverityPdfStyle(severity: string) {
  switch (severity) {
    case "critical":
      return { backgroundColor: pdfColors.criticalBg, color: pdfColors.criticalText };
    case "high":
      return { backgroundColor: pdfColors.highBg, color: pdfColors.highText };
    case "medium":
      return { backgroundColor: pdfColors.mediumBg, color: pdfColors.mediumText };
    case "low":
      return { backgroundColor: pdfColors.lowBg, color: pdfColors.lowText };
    default:
      return { backgroundColor: pdfColors.infoBg, color: pdfColors.infoText };
  }
}
