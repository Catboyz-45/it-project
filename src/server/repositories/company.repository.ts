import type { Company, Prisma } from "@prisma/client";
import { db } from "@/server/db/client";

const companyPublicSelect = {
  id: true,
  legalName: true,
  displayName: true,
  shortDescription: true,
  history: true,
  vision: true,
  mission: true,
  address: true,
  phoneDisplay: true,
  phoneHref: true,
  email: true,
  lineLabel: true,
  lineUrl: true,
  facebookUrl: true,
  mapsUrl: true,
  mapsEmbedUrl: true,
  businessHours: true,
  seoTitle: true,
  seoDescription: true,
  logoMedia: { select: { id: true, objectKey: true, altText: true, width: true, height: true } },
} satisfies Prisma.CompanySelect;

export class CompanyRepository {
  findPrimary() {
    return db.company.findUnique({ where: { singletonKey: "PRIMARY" }, select: companyPublicSelect });
  }

  upsertPrimary(data: Omit<Prisma.CompanyUncheckedCreateInput, "id" | "singletonKey" | "createdAt" | "updatedAt">): Promise<Company> {
    return db.company.upsert({
      where: { singletonKey: "PRIMARY" },
      create: { ...data, singletonKey: "PRIMARY" },
      update: data,
    });
  }
}
