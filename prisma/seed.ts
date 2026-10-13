import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

const PASSWORD = "Password123";

const SUBJECTS = [
  { code: "CS-101", name: "Introduction to Computer Science", semester: 1, department: "Computer Science" },
  { code: "CS-201", name: "Data Structures", semester: 3, department: "Computer Science" },
  { code: "CS-301", name: "Database Management Systems", semester: 5, department: "Computer Science" },
  { code: "CS-401", name: "Machine Learning", semester: 7, department: "Computer Science" },
  { code: "MATH-201", name: "Linear Algebra", semester: 3, department: "Mathematics" },
  { code: "MATH-301", name: "Probability and Statistics", semester: 5, department: "Mathematics" },
  { code: "PHY-201", name: "Classical Mechanics", semester: 3, department: "Physics" },
  { code: "ENG-101", name: "Technical and Academic Writing", semester: 1, department: "English" },
];

async function main() {
  console.log("Seeding database...");

  await prisma.previewJob.deleteMany();
  await prisma.download.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.material.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash(PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      name: "System Administrator",
      email: "admin@university.edu",
      passwordHash,
      role: "ADMIN",
      department: "Administration",
    },
  });

  const profAyesha = await prisma.user.create({
    data: {
      name: "Dr. Ayesha Khan",
      email: "ayesha.khan@university.edu",
      passwordHash,
      role: "PROFESSOR",
      department: "Computer Science",
    },
  });

  const profBilal = await prisma.user.create({
    data: {
      name: "Prof. Bilal Ahmed",
      email: "bilal.ahmed@university.edu",
      passwordHash,
      role: "PROFESSOR",
      department: "Mathematics",
    },
  });

  const students = await Promise.all([
    prisma.user.create({
      data: {
        name: "Ali Raza",
        email: "ali.raza@student.university.edu",
        passwordHash,
        role: "STUDENT",
        department: "Computer Science",
      },
    }),
    prisma.user.create({
      data: {
        name: "Sara Iqbal",
        email: "sara.iqbal@student.university.edu",
        passwordHash,
        role: "STUDENT",
        department: "Computer Science",
      },
    }),
    prisma.user.create({
      data: {
        name: "Hamza Sheikh",
        email: "hamza.sheikh@student.university.edu",
        passwordHash,
        role: "STUDENT",
        department: "Electrical Engineering",
      },
    }),
  ]);

  console.log(`Created ${SUBJECTS.length} subjects`);

  const subjects = await Promise.all(
    SUBJECTS.map((subject) => prisma.subject.create({ data: subject })),
  );
  const byCode = new Map(subjects.map((subject) => [subject.code, subject]));

  // Real files are not bundled with the repo, so sample materials are created as
  // metadata only. Uploading a file through the professor UI replaces these.
  const samples = [
    {
      title: "Lecture 01 - Introduction to CS and Course Overview",
      description: "Syllabus, grading policy and an introduction to computer science.",
      extension: "pdf",
      subjectCode: "CS-101",
      professorId: profAyesha.id,
    },
    {
      title: "Lecture 05 - Linked Lists",
      description: "Singly and doubly linked lists, with implementation notes.",
      extension: "pptx",
      subjectCode: "CS-201",
      professorId: profAyesha.id,
    },
    {
      title: "Normalization Reference Sheet",
      description: "1NF through BCNF with worked examples.",
      extension: "pdf",
      subjectCode: "CS-301",
      professorId: profAyesha.id,
    },
    {
      title: "Week 3 - Supervised Learning Setup",
      description: "Train/test splits, overfitting and cross validation.",
      extension: "pptx",
      subjectCode: "CS-401",
      professorId: profAyesha.id,
    },
    {
      title: "Eigenvalues and Eigenvectors - Full Derivation",
      description: "Step by step derivation with solved problems.",
      extension: "pdf",
      subjectCode: "MATH-201",
      professorId: profBilal.id,
    },
    {
      title: "Practice Problem Set 2",
      description: "Twelve questions covering distributions and expectation.",
      extension: "pdf",
      subjectCode: "MATH-301",
      professorId: profBilal.id,
    },
    {
      title: "Chapter 1 - Newtonian Mechanics Slides",
      description: "Motion in one and two dimensions, conservation laws.",
      extension: "ppt",
      subjectCode: "PHY-201",
      professorId: profBilal.id,
    },
    {
      title: "Essay Structure Template",
      description: "A reusable outline for academic essays.",
      extension: "docx",
      subjectCode: "ENG-101",
      professorId: profAyesha.id,
    },
  ];

  for (const sample of samples) {
    const subject = byCode.get(sample.subjectCode);
    if (!subject) continue;
    await prisma.material.create({
      data: {
        title: sample.title,
        description: sample.description,
        originalName: `${sample.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${sample.extension}`,
        storedName: `sample-${sample.subjectCode.toLowerCase()}.${sample.extension}`,
        extension: sample.extension,
        mimeType: "application/octet-stream",
        sizeBytes: 0,
        downloadCount: 0,
        previewStatus: "NONE",
        subjectId: subject.id,
        professorId: sample.professorId,
      },
    });
  }

  console.log(`Created ${samples.length} sample material records`);

  // Mark a couple of favourites so the demo account is not empty.
  const materials = await prisma.material.findMany({ take: 2 });
  if (materials.length === 2) {
    await prisma.favorite.create({
      data: { userId: students[0].id, materialId: materials[0].id },
    });
    await prisma.favorite.create({
      data: { userId: students[0].id, materialId: materials[1].id },
    });
  }

  console.log("\nSeed complete. Accounts (password for all: " + PASSWORD + ")");
  console.log("  Admin     admin@university.edu");
  console.log("  Professor ayesha.khan@university.edu");
  console.log("  Professor bilal.ahmed@university.edu");
  console.log("  Student   ali.raza@student.university.edu");
  console.log(`  Admin id  ${admin.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
