import {
  createImageConverterMetadata,
  createImageConverterPage,
} from "@/lib/image-tools/create-converter-page";
import { getConverterBySlug } from "@/constants/image-tools";

const config = getConverterBySlug("webp-to-jpg")!;

export const metadata = createImageConverterMetadata(config);
export default createImageConverterPage(config);
