import { prisma } from "../src/db/prisma.js";
import bcrypt from "bcrypt";

async function main() {
    const username = "admin";
    const password = "hosianaceria123";

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
        where: { username },
    });

    if (existingAdmin) {
        console.log("⚠️ Admin already exists. Skipping admin creation.");
    } else {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
    
        // Create admin
        await prisma.admin.create({
            data: {
                username,
                password: hashedPassword,
                role: "admin",
            },
        });
        console.log(`✅ Admin created: ${username}`);
    }



    // Create superadmin
    const superadminUsername = "superadmin";
    const superadminPassword = "superpassword123"; // You should probably change this or load from env

    const existingSuperadmin = await prisma.admin.findUnique({
        where: { username: superadminUsername },
    });

    if (existingSuperadmin) {
        console.log("⚠️ Superadmin already exists. Skipping.");
    } else {
        const superadminSalt = await bcrypt.genSalt(10);
        const hashedSuperadminPassword = await bcrypt.hash(superadminPassword, superadminSalt);

        await prisma.admin.create({
            data: {
                username: superadminUsername,
                password: hashedSuperadminPassword,
                role: "superadmin", // Enforce role
            },
        });
        console.log(`✅ Superadmin created: ${superadminUsername} / ${superadminPassword}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
