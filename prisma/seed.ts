import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Fictional Tunisian context. No real personal data — invented names & IDs.
const HUBS = [
  { name: "Tunis Centre Hub", lat: 36.8065, lng: 10.1815, gateways: 3 },
  { name: "La Marsa Hub", lat: 36.8782, lng: 10.3247, gateways: 2 },
  { name: "Ariana Hub", lat: 36.8625, lng: 10.1956, gateways: 2 },
  { name: "Ben Arous Hub", lat: 36.7533, lng: 10.2281, gateways: 1 },
  { name: "Sfax Hub", lat: 34.7406, lng: 10.7603, gateways: 1 },
];

const CLIENT_NAMES = [
  "Mohamed Ben Ali", "Amira Trabelsi", "Yassine Gharbi", "Selma Bouazizi",
  "Khaled Mansour", "Rania Jelassi", "Aymen Khediri", "Ines Belhadj",
  "Fares Sassi", "Nour Chatti", "Oussama Riahi", "Maha Zouari",
];

const MODELS = ["Volt City 48", "Volt Sport 60", "EcoRide S1", "EcoRide Pro"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

async function main() {
  console.log("Clearing existing data…");
  // Order matters for FK constraints.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.maintenanceRecord.deleteMany(),
    prisma.batteryAssignment.deleteMany(),
    prisma.aiPrediction.deleteMany(),
    prisma.riskScore.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.batteryReading.deleteMany(),
    prisma.vehicleLocation.deleteMany(),
    prisma.telemetry.deleteMany(),
    prisma.rental.deleteMany(),
    prisma.reservation.deleteMany(),
  ]);
  await prisma.vehicle.updateMany({ data: { batteryId: null } });
  await prisma.$transaction([
    prisma.vehicle.deleteMany(),
    prisma.battery.deleteMany(),
    prisma.hub.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Seeding users…");
  const ownerPw = await bcrypt.hash("owner123", 10);
  const clientPw = await bcrypt.hash("client123", 10);

  const owner = await prisma.user.create({
    data: {
      email: "owner@emove.tn",
      passwordHash: ownerPw,
      role: "OWNER",
      fullName: "Leila Ben Youssef",
      phone: "+216 20 000 001",
      locale: "en",
    },
  });

  const clients = [];
  for (let i = 0; i < CLIENT_NAMES.length; i++) {
    const isTn = i % 4 !== 0;
    clients.push(
      await prisma.user.create({
        data: {
          email: `client${i + 1}@emove.tn`,
          passwordHash: clientPw,
          role: "CLIENT",
          fullName: CLIENT_NAMES[i],
          phone: `+216 2${i} 111 ${100 + i}`,
          locale: pick(["en", "fr", "ar"], i),
          idType: isTn ? "CIN" : "PASSPORT",
          idNumber: isTn ? `${10000000 + i * 37}` : `TN${900000 + i}`,
          dateOfBirth: new Date(1990 + (i % 15), i % 12, (i % 27) + 1),
        },
      })
    );
  }
  // A primary demo client for easy login.
  const demoClient = await prisma.user.create({
    data: {
      email: "client@emove.tn",
      passwordHash: clientPw,
      role: "CLIENT",
      fullName: "Sami Haddad",
      phone: "+216 20 000 002",
      locale: "en",
      idType: "CIN",
      idNumber: "09876543",
      dateOfBirth: new Date(1995, 5, 12),
    },
  });
  clients.push(demoClient);

  console.log("Seeding hubs…");
  const hubs = [];
  for (const h of HUBS) hubs.push(await prisma.hub.create({ data: h }));

  console.log("Seeding batteries…");
  const batteries = [];
  for (let i = 1; i <= 30; i++) {
    const cycles = Math.round(rand(20, 600));
    const age = Math.round(rand(1, 30));
    const soh = Math.max(35, Math.round(100 - cycles / 12 - age / 2 - rand(0, 8)));
    const status =
      soh < 45 ? "SERVICE" : soh < 60 ? "ATTENTION" : i % 5 === 0 ? "CHARGING" : "READY";
    batteries.push(
      await prisma.battery.create({
        data: {
          code: `BAT-${String(i).padStart(3, "0")}`,
          voltageClass: 48,
          capacityWh: 1200,
          cycleCount: cycles,
          ageMonths: age,
          soh,
          soc: Math.round(rand(35, 100)),
          status,
          hubId: pick(hubs, i).id,
        },
      })
    );
  }

  console.log("Seeding vehicles…");
  const vehicles = [];
  for (let i = 1; i <= 20; i++) {
    const hub = pick(hubs, i);
    const v = await prisma.vehicle.create({
      data: {
        code: `EV-${String(i).padStart(3, "0")}`,
        model: pick(MODELS, i),
        voltageClass: 48,
        rangeKm: 55 + (i % 4) * 8,
        pricePerHour: 8 + (i % 4) * 2,
        status: "AVAILABLE",
        homeLat: hub.lat + rand(-0.01, 0.01),
        homeLng: hub.lng + rand(-0.01, 0.01),
      },
    });
    vehicles.push(v);
  }

  console.log("Assigning batteries to vehicles…");
  // First 20 batteries go to vehicles (rest stay in the hub).
  for (let i = 0; i < vehicles.length; i++) {
    const bat = batteries[i];
    await prisma.vehicle.update({
      where: { id: vehicles[i].id },
      data: { batteryId: bat.id },
    });
    await prisma.battery.update({ where: { id: bat.id }, data: { status: "ASSIGNED" } });
    await prisma.batteryAssignment.create({
      data: { batteryId: bat.id, vehicleId: vehicles[i].id },
    });
  }

  console.log("Seeding telemetry history & locations…");
  const now = Date.now();
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const bat = batteries[i];
    let lat = v.homeLat;
    let lng = v.homeLng;
    for (let k = 30; k >= 0; k--) {
      const ts = new Date(now - k * 3 * 60 * 1000);
      lat += rand(-0.0006, 0.0006);
      lng += rand(-0.0006, 0.0006);
      const temp = 30 + rand(-2, 5);
      const volt = 40 + rand(-1, 1);
      const soc = Math.max(20, bat.soc - k * 0.3);
      await prisma.telemetry.create({
        data: {
          vehicleId: v.id,
          batteryCode: bat.code,
          timestamp: ts,
          latitude: lat,
          longitude: lng,
          temperature: temp,
          voltage: volt,
          soc,
          speed: Math.random() < 0.5 ? 0 : Math.round(rand(12, 30)),
          bleSignal: -49 + Math.round(rand(-2, 2)),
          bleConfidence: "HIGH",
          gpsAvailable: true,
          bleAvailable: true,
          scenario: "NORMAL",
        },
      });
      await prisma.vehicleLocation.create({
        data: { vehicleId: v.id, lat, lng, gpsConfidence: 0.9, timestamp: ts },
      });
    }
    // A few battery readings.
    for (let k = 10; k >= 0; k--) {
      await prisma.batteryReading.create({
        data: {
          batteryId: bat.id,
          timestamp: new Date(now - k * 10 * 60 * 1000),
          temperature: 30 + rand(-2, 6),
          voltage: 40 + rand(-1, 1),
          soc: Math.max(20, bat.soc - k),
          charging: k > 8,
        },
      });
    }
  }

  console.log("Seeding rentals & reservations…");
  // 5 active rentals.
  for (let i = 0; i < 5; i++) {
    const v = vehicles[i];
    const c = clients[i];
    const start = new Date(now - rand(1, 3) * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    await prisma.vehicle.update({ where: { id: v.id }, data: { status: "RENTED" } });
    await prisma.rental.create({
      data: {
        userId: c.id,
        vehicleId: v.id,
        startTime: start,
        endTime: end,
        status: "ACTIVE",
        priceTotal: v.pricePerHour * 4,
      },
    });
  }
  // 1 maintenance vehicle.
  await prisma.vehicle.update({ where: { id: vehicles[5].id }, data: { status: "MAINTENANCE" } });
  await prisma.maintenanceRecord.create({
    data: { vehicleId: vehicles[5].id, kind: "INSPECTION", note: "Scheduled brake inspection." },
  });

  // Upcoming reservations.
  for (let i = 6; i < 10; i++) {
    const v = vehicles[i];
    const c = clients[i];
    const start = new Date(now + rand(2, 48) * 60 * 60 * 1000);
    const hours = 2 + (i % 4);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    await prisma.reservation.create({
      data: {
        userId: c.id,
        vehicleId: v.id,
        startTime: start,
        endTime: end,
        hours,
        priceTotal: v.pricePerHour * hours,
        paymentMethod: i % 2 ? "ONLINE" : "PAY_AT_SHOP",
        paymentStatus: i % 2 ? "PAID" : "PENDING",
        status: "UPCOMING",
      },
    });
  }

  // Past rentals for the demo client.
  for (let i = 0; i < 3; i++) {
    const v = vehicles[10 + i];
    const start = new Date(now - (i + 2) * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    await prisma.rental.create({
      data: {
        userId: demoClient.id,
        vehicleId: v.id,
        startTime: start,
        endTime: end,
        status: "RETURNED",
        priceTotal: v.pricePerHour * 3,
      },
    });
  }

  console.log("Seeding a welcome notification…");
  await prisma.notification.create({
    data: {
      userId: owner.id,
      type: "WELCOME",
      title: "Welcome to E-Move Guardian",
      body: "Your fleet is live. Open the Demo Control panel to run the full scenario.",
      severity: "INFO",
    },
  });

  console.log("\n✅ Seed complete.");
  console.log("   Owner:  owner@emove.tn / owner123");
  console.log("   Client: client@emove.tn / client123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
