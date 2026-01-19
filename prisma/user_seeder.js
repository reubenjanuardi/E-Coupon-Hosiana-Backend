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
        console.log("⚠️ Admin already exists. Skipping seed.");
        return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    await prisma.admin.create({
        data: {
            username,
            password: hashedPassword,
        },
    });

    console.log(`✅ Admin created: ${username} / ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
