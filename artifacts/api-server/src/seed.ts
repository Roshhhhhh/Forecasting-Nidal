/**
 * Seed script for RHH Property Revenue Forecaster.
 * Run once: pnpm --filter @workspace/api-server run seed
 */
import bcrypt from "bcrypt";
import {
  db,
  usersTable,
  ownersTable,
  propertiesTable,
  marketAreasTable,
  unitBenchmarksTable,
  forecastsTable,
  forecastScenariosTable,
  monthlyProjectionsTable,
  proposalsTable,
  companySettingsTable,
} from "@workspace/db";
import { calculateMonthlyProjections, calculateScenario } from "./lib/calculate";
import crypto from "crypto";

async function seed() {
  console.log("🌱 Seeding RHH database...");

  // Company settings
  const existingSettings = await db.query.companySettingsTable.findFirst();
  if (!existingSettings) {
    await db.insert(companySettingsTable).values({
      companyName: "Royal Holiday Homes",
      brandName: "Royal Holiday Homes",
      currency: "AED",
      goldBrandColor: "#C9963B",
      phone: "+971 2 123 4567",
      tollFree: "800-RHH",
      website: "https://royalholidayhomes.ae",
      ownerEmail: "owners@royalholidayhomes.ae",
      guestEmail: "guests@royalholidayhomes.ae",
      address: "Abu Dhabi, UAE",
      defaultManagementFeePercent: 20,
      defaultLtrVacancyPercent: 10,
      proposalValidityDays: 30,
      portfolioManagedProperties: 120,
      portfolioFiveStarReviews: 1840,
      portfolioMonthlyBookings: 340,
      portfolioMonthlyTravelers: 680,
      portfolioTrustedOwners: 95,
    });
    console.log("✅ Company settings created");
  }

  // Users
  const existingUsers = await db.select().from(usersTable).limit(1);
  if (existingUsers.length === 0) {
    const hash = await bcrypt.hash("Admin123!", 12);
    await db.insert(usersTable).values([
      {
        email: "admin@royalholidayhomes.ae",
        name: "Ahmed Al Mansouri",
        passwordHash: hash,
        role: "super_admin",
        phone: "+971 50 111 2222",
      },
      {
        email: "revenue@royalholidayhomes.ae",
        name: "Sarah Mitchell",
        passwordHash: await bcrypt.hash("Revenue123!", 12),
        role: "revenue_manager",
        phone: "+971 50 333 4444",
      },
      {
        email: "sales@royalholidayhomes.ae",
        name: "Omar Khalid",
        passwordHash: await bcrypt.hash("Sales123!", 12),
        role: "sales",
        phone: "+971 55 555 6666",
      },
    ]);
    console.log("✅ Users created (admin@royalholidayhomes.ae / Admin123!)");
  }

  const [adminUser] = await db.select().from(usersTable).limit(1);

  // Market areas
  const existingAreas = await db.select().from(marketAreasTable).limit(1);
  if (existingAreas.length === 0) {
    const areaData = [
      { area: "Yas Island", development: "Yas Island", developer: "Aldar Properties" },
      { area: "Al Raha Beach", development: "Al Raha Beach", developer: "Aldar Properties" },
      { area: "Saadiyat Island", development: "Saadiyat Island", developer: "TDIC" },
      { area: "Al Reem Island", development: "Al Reem Island", developer: "Various" },
      { area: "Corniche", development: "Corniche District", developer: "Various" },
      { area: "Al Maryah Island", development: "Al Maryah Island", developer: "Gulf Related" },
      { area: "Khalidiyah", development: null, developer: null },
      { area: "Mohammed Bin Zayed City", development: null, developer: null },
    ];

    const insertedAreas: any[] = [];
    for (const area of areaData) {
      const [a] = await db.insert(marketAreasTable).values({ ...area, emirate: "Abu Dhabi", createdById: adminUser.id }).returning();
      insertedAreas.push(a);
    }

    // Benchmarks for each area
    const benchmarkDefs = [
      // Yas Island
      { areaIndex: 0, bedrooms: 0, pType: "studio", adr: 380, ltr: 58000 },
      { areaIndex: 0, bedrooms: 1, pType: "apartment", adr: 520, ltr: 85000 },
      { areaIndex: 0, bedrooms: 2, pType: "apartment", adr: 720, ltr: 115000 },
      { areaIndex: 0, bedrooms: 3, pType: "apartment", adr: 1050, ltr: 155000 },
      // Al Raha Beach
      { areaIndex: 1, bedrooms: 1, pType: "apartment", adr: 480, ltr: 78000 },
      { areaIndex: 1, bedrooms: 2, pType: "apartment", adr: 680, ltr: 108000 },
      { areaIndex: 1, bedrooms: 3, pType: "apartment", adr: 950, ltr: 145000 },
      // Saadiyat Island
      { areaIndex: 2, bedrooms: 1, pType: "apartment", adr: 580, ltr: 95000 },
      { areaIndex: 2, bedrooms: 2, pType: "apartment", adr: 850, ltr: 135000 },
      { areaIndex: 2, bedrooms: 3, pType: "villa", adr: 1400, ltr: 200000 },
      { areaIndex: 2, bedrooms: 4, pType: "villa", adr: 1900, ltr: 280000 },
      // Al Reem Island
      { areaIndex: 3, bedrooms: 0, pType: "studio", adr: 320, ltr: 52000 },
      { areaIndex: 3, bedrooms: 1, pType: "apartment", adr: 440, ltr: 72000 },
      { areaIndex: 3, bedrooms: 2, pType: "apartment", adr: 620, ltr: 100000 },
      { areaIndex: 3, bedrooms: 3, pType: "apartment", adr: 880, ltr: 138000 },
      // Corniche
      { areaIndex: 4, bedrooms: 1, pType: "apartment", adr: 500, ltr: 88000 },
      { areaIndex: 4, bedrooms: 2, pType: "apartment", adr: 730, ltr: 125000 },
    ];

    for (const bd of benchmarkDefs) {
      await db.insert(unitBenchmarksTable).values({
        marketAreaId: insertedAreas[bd.areaIndex].id,
        propertyType: bd.pType,
        bedrooms: bd.bedrooms,
        typicalAdr: bd.adr,
        lowSeasonAdr: Math.round(bd.adr * 0.70),
        shoulderSeasonAdr: Math.round(bd.adr * 0.90),
        peakSeasonAdr: Math.round(bd.adr * 1.15),
        eventAdr: Math.round(bd.adr * 1.45),
        expectedOccupancy: 80,
        annualLtr: bd.ltr,
        minLtr: Math.round(bd.ltr * 0.85),
        maxLtr: Math.round(bd.ltr * 1.15),
        confidenceLevel: "high",
        dataSource: "RHH Internal Database + CBRE",
        sourceDate: "2025-01",
        createdById: adminUser.id,
      });
    }
    console.log("✅ Market areas and benchmarks created");
  }

  // Owners
  const existingOwners = await db.select().from(ownersTable).limit(1);
  if (existingOwners.length === 0) {
    const [owner1] = await db.insert(ownersTable).values([
      {
        ownerType: "individual",
        title: "H.E.",
        firstName: "Khalid",
        lastName: "Al Rashidi",
        email: "khalid.alrashidi@email.com",
        phone: "+971 50 234 5678",
        whatsapp: "+971 50 234 5678",
        nationality: "Emirati",
        preferredLanguage: "Arabic",
        isExistingClient: false,
        leadSource: "referral",
        objectives: ["maximize_income", "hassle_free"],
        createdById: adminUser.id,
        assignedToId: adminUser.id,
      },
    ]).returning();

    const [owner2] = await db.insert(ownersTable).values([
      {
        ownerType: "individual",
        title: "Mr",
        firstName: "James",
        lastName: "Thornton",
        email: "james.thornton@email.com",
        phone: "+44 7911 123456",
        nationality: "British",
        preferredLanguage: "English",
        isExistingClient: true,
        leadSource: "existing_client",
        objectives: ["maximize_income"],
        createdById: adminUser.id,
        assignedToId: adminUser.id,
      },
    ]).returning();

    const [owner3] = await db.insert(ownersTable).values([
      {
        ownerType: "individual",
        title: "Ms",
        firstName: "Fatima",
        lastName: "Al Zaabi",
        email: "fatima.alzaabi@email.com",
        phone: "+971 55 678 9012",
        nationality: "Emirati",
        preferredLanguage: "Arabic",
        isExistingClient: false,
        leadSource: "walk_in",
        objectives: ["trial_str"],
        createdById: adminUser.id,
        assignedToId: adminUser.id,
      },
    ]).returning();

    const owners = [owner1, owner2, owner3];
    console.log("✅ Owners created");

    // Properties
    const [prop1] = await db.insert(propertiesTable).values({
      ownerId: owner1.id,
      emirate: "Abu Dhabi",
      area: "Yas Island",
      development: "Yas Island",
      projectBuilding: "Ansam",
      tower: "A",
      unitNumber: "1204",
      floor: 12,
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 2,
      hasMaidsRoom: false,
      hasStudy: false,
      balconies: 1,
      parkingSpaces: 1,
      internalArea: 1250,
      externalArea: 150,
      furnishingStatus: "fully_furnished",
      propertyCondition: "excellent",
      view: "Golf Course",
      floorCategory: "high",
      isWaterfront: false,
      hasPrivatePool: false,
      dctPermitStatus: "eligible",
      currentTenancyStatus: "vacant",
      availabilityDate: "2025-02-01",
      createdById: adminUser.id,
    }).returning();

    const [prop2] = await db.insert(propertiesTable).values({
      ownerId: owner2.id,
      emirate: "Abu Dhabi",
      area: "Al Raha Beach",
      development: "Al Raha Beach",
      projectBuilding: "Al Zeina",
      tower: "B2",
      unitNumber: "405",
      floor: 4,
      propertyType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      hasMaidsRoom: false,
      hasStudy: false,
      balconies: 1,
      parkingSpaces: 1,
      internalArea: 850,
      furnishingStatus: "fully_furnished",
      propertyCondition: "good",
      view: "Sea",
      floorCategory: "mid",
      isWaterfront: true,
      hasPrivatePool: false,
      currentTenancyStatus: "vacant",
      createdById: adminUser.id,
    }).returning();

    const [prop3] = await db.insert(propertiesTable).values({
      ownerId: owner3.id,
      emirate: "Abu Dhabi",
      area: "Saadiyat Island",
      development: "Saadiyat Island",
      projectBuilding: "Mamsha Al Saadiyat",
      unitNumber: "PH-01",
      floor: 20,
      propertyType: "penthouse",
      bedrooms: 3,
      bathrooms: 3.5,
      hasMaidsRoom: true,
      hasStudy: true,
      balconies: 2,
      parkingSpaces: 2,
      internalArea: 2800,
      externalArea: 500,
      furnishingStatus: "premium_furnished",
      propertyCondition: "excellent",
      view: "Beach & Sea",
      floorCategory: "penthouse",
      isWaterfront: true,
      hasDirectBeachAccess: true,
      hasPrivatePool: false,
      currentTenancyStatus: "vacant",
      createdById: adminUser.id,
    }).returning();

    console.log("✅ Properties created");

    // Forecasts with different statuses for demo pipeline
    const forecastInputsBase = {
      managementFeePercent: 20,
      ltrVacancyPercent: 10,
      ownerBlockedNights: 0,
      internetCost: 7200,
      utilityCost: 14400,
      maintenanceCost: 8000,
      miscCost: 3600,
    };

    // Forecast 1: DRAFT (prop1 - Yas Island 2BR)
    const fcInputs1 = {
      ...forecastInputsBase,
      annualLtr: 115000,
      lowSeasonAdr: 504,
      shoulderSeasonAdr: 648,
      peakSeasonAdr: 828,
      eventAdr: 1044,
      occupancyRate: 0.80,
    };
    const calc1 = calculateMonthlyProjections(fcInputs1);
    const [fc1] = await db.insert(forecastsTable).values({
      referenceNumber: "RHH-2025-DEMO1",
      ownerId: owner1.id,
      propertyId: prop1.id,
      status: "draft",
      ...fcInputs1,
      recommendedOccupancy: 0.80,
      ...calc1,
      monthlyProjections: undefined as any,
      reconciliationStatus: "passed",
      narrativeText: "Ansam Yas Island offers exceptional STR potential driven by year-round event demand from Formula 1, Yas Waterworld, Ferrari World and Warner Bros. Park. The golf course view commands consistent premium pricing with strong corporate and leisure traveller demand.",
      assignedToId: adminUser.id,
      createdById: adminUser.id,
    }).returning();
    await db.insert(monthlyProjectionsTable).values(calc1.monthlyProjections.map(m => ({ ...m, forecastId: fc1.id })));

    // Forecast 2: PUBLISHED (prop2 - Al Raha Beach 1BR)
    const fcInputs2 = {
      ...forecastInputsBase,
      annualLtr: 78000,
      lowSeasonAdr: 336,
      shoulderSeasonAdr: 432,
      peakSeasonAdr: 552,
      eventAdr: 696,
      occupancyRate: 0.82,
    };
    const calc2 = calculateMonthlyProjections({ ...fcInputs2, occupancyRate: 0.82 });
    const shareToken2 = crypto.randomBytes(16).toString("hex");
    const [fc2] = await db.insert(forecastsTable).values({
      referenceNumber: "RHH-2025-DEMO2",
      ownerId: owner2.id,
      propertyId: prop2.id,
      status: "viewed",
      ...fcInputs2,
      recommendedOccupancy: 0.82,
      ...calc2,
      monthlyProjections: undefined as any,
      reconciliationStatus: "passed",
      narrativeText: "Al Zeina Al Raha Beach presents a waterfront lifestyle unique in Abu Dhabi's STR landscape. Sea views, proximity to Abu Dhabi International Airport and direct beach access drive consistent premium bookings from international travellers and business guests.",
      assignedToId: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdById: adminUser.id,
    }).returning();
    await db.insert(monthlyProjectionsTable).values(calc2.monthlyProjections.map(m => ({ ...m, forecastId: fc2.id })));
    await db.insert(proposalsTable).values({
      forecastId: fc2.id,
      referenceNumber: "RHH-2025-DEMO2",
      status: "viewed",
      shareToken: shareToken2,
      shareUrl: `/api/p/${shareToken2}`,
      isLinkActive: true,
      expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      totalViews: 4,
      uniqueViews: 2,
      lastViewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      createdById: adminUser.id,
    });

    // Forecast 3: ACCEPTED (prop3 - Saadiyat penthouse)
    const fcInputs3 = {
      ...forecastInputsBase,
      annualLtr: 200000,
      lowSeasonAdr: 980,
      shoulderSeasonAdr: 1260,
      peakSeasonAdr: 1610,
      eventAdr: 2030,
      occupancyRate: 0.78,
    };
    const calc3 = calculateMonthlyProjections({ ...fcInputs3, occupancyRate: 0.78 });
    const shareToken3 = crypto.randomBytes(16).toString("hex");
    const [fc3] = await db.insert(forecastsTable).values({
      referenceNumber: "RHH-2025-DEMO3",
      ownerId: owner3.id,
      propertyId: prop3.id,
      status: "accepted",
      ...fcInputs3,
      recommendedOccupancy: 0.78,
      ...calc3,
      monthlyProjections: undefined as any,
      reconciliationStatus: "passed",
      narrativeText: "The Mamsha Al Saadiyat Penthouse represents the apex of Abu Dhabi's luxury STR market. With direct beach access, panoramic sea views, and proximity to the Louvre Abu Dhabi and Guggenheim site, this property commands ultra-premium nightly rates from ultra-high-net-worth travellers.",
      assignedToId: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdById: adminUser.id,
    }).returning();
    await db.insert(monthlyProjectionsTable).values(calc3.monthlyProjections.map(m => ({ ...m, forecastId: fc3.id })));
    await db.insert(proposalsTable).values({
      forecastId: fc3.id,
      referenceNumber: "RHH-2025-DEMO3",
      status: "accepted",
      shareToken: shareToken3,
      shareUrl: `/api/p/${shareToken3}`,
      isLinkActive: true,
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      totalViews: 7,
      uniqueViews: 3,
      lastViewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      ownerAction: "accept",
      ownerActionAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      ownerActionName: "Fatima Al Zaabi",
      ownerActionEmail: "fatima.alzaabi@email.com",
      ownerActionPhone: "+971 55 678 9012",
      createdById: adminUser.id,
    });

    // Add scenarios for all forecasts
    const scenarioDefs = [
      { name: "Conservative", occupancyRate: 0.75, adrMultiplier: 1.0, isRecommended: false },
      { name: "Realistic", occupancyRate: 0.80, adrMultiplier: 1.0, isRecommended: true },
      { name: "Confident", occupancyRate: 0.85, adrMultiplier: 1.0, isRecommended: false },
      { name: "Optimistic", occupancyRate: 0.90, adrMultiplier: 1.0, isRecommended: false },
    ];

    for (const fc of [fc1, fc2, fc3]) {
      const inputs = fc.id === fc1.id ? fcInputs1 : fc.id === fc2.id ? fcInputs2 : fcInputs3;
      const fullInputs = { ...inputs, lowSeasonAdr: inputs.lowSeasonAdr!, shoulderSeasonAdr: inputs.shoulderSeasonAdr!, peakSeasonAdr: inputs.peakSeasonAdr!, eventAdr: inputs.eventAdr!, annualLtr: inputs.annualLtr };
      await db.insert(forecastScenariosTable).values(
        scenarioDefs.map(s => {
          const sc = calculateScenario(fullInputs as any, s.occupancyRate, s.adrMultiplier);
          return { ...s, forecastId: fc.id, ...sc };
        })
      );
    }

    // Ensure proposals exist for fc1
    await db.insert(proposalsTable).values({
      forecastId: fc1.id,
      referenceNumber: "RHH-2025-DEMO1",
      status: "draft",
      createdById: adminUser.id,
    });

    console.log("✅ Forecasts, proposals and scenarios created");
  }

  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
