import { z } from "zod";
import { CompanyRepository } from "@/server/repositories/company.repository";

const optionalUrl = z.union([z.literal(""), z.string().url()]).transform((value) => value || null);

export const companyInputSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(160),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  history: z.string().trim().max(20_000).nullable().optional(),
  vision: z.string().trim().max(10_000).nullable().optional(),
  mission: z.string().trim().max(10_000).nullable().optional(),
  address: z.string().trim().max(2_000).nullable().optional(),
  phoneDisplay: z.string().trim().max(50).nullable().optional(),
  phoneHref: z.string().trim().max(30).regex(/^\+?[0-9]{8,15}$/).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  lineLabel: z.string().trim().max(100).nullable().optional(),
  lineUrl: optionalUrl.nullable().optional(),
  facebookUrl: optionalUrl.nullable().optional(),
  mapsUrl: optionalUrl.nullable().optional(),
  mapsEmbedUrl: optionalUrl.nullable().optional(),
  businessHours: z.string().trim().max(200).nullable().optional(),
  seoTitle: z.string().trim().max(60).nullable().optional(),
  seoDescription: z.string().trim().max(160).nullable().optional(),
  logoMediaId: z.string().trim().max(30).nullable().optional(),
}).strict();

export class CompanyService {
  constructor(private readonly companies = new CompanyRepository()) {}

  updatePrimary(input: z.input<typeof companyInputSchema>) {
    return this.companies.upsertPrimary(companyInputSchema.parse(input));
  }
}
