import { db } from "@/lib/firebase/config"
import { collection, addDoc } from "firebase/firestore"

// This script helps you seed the database with sample data
// Run this after creating users through the registration page

export async function seedDatabase() {
  try {
    console.log("Starting database seeding...")

    // Sample project ideas
    const projectIdeas = [
      {
        title: "نظام إدارة المكتبات الذكي",
        description: "نظام متكامل لإدارة المكتبات الجامعية مع ميزات البحث والحجز الإلكتروني",
        category: "تطبيقات الويب",
        difficulty: "متوسط",
        requiredSkills: ["React", "Node.js", "MongoDB"],
        status: "متاح",
        createdAt: new Date().toISOString(),
      },
      {
        title: "تطبيق الذكاء الاصطناعي للتشخيص الطبي",
        description: "استخدام تقنيات التعلم العميق لتشخيص الأمراض من الصور الطبية",
        category: "الذكاء الاصطناعي",
        difficulty: "صعب",
        requiredSkills: ["Python", "TensorFlow", "Computer Vision"],
        status: "متاح",
        createdAt: new Date().toISOString(),
      },
      {
        title: "منصة التجارة الإلكترونية",
        description: "منصة متكاملة للتجارة الإلكترونية مع نظام دفع آمن",
        category: "تطبيقات الويب",
        difficulty: "متوسط",
        requiredSkills: ["Next.js", "Stripe", "PostgreSQL"],
        status: "متاح",
        createdAt: new Date().toISOString(),
      },
    ]

    for (const idea of projectIdeas) {
      await addDoc(collection(db, "projectIdeas"), idea)
    }

    console.log("✅ Project ideas seeded successfully")

    // Sample notifications template
    console.log("\n📝 To add sample data:")
    console.log("1. Register users with different roles (student, supervisor, coordinator)")
    console.log("2. Students can submit projects")
    console.log("3. Coordinators can assign supervisors")
    console.log("4. Supervisors can add tasks and schedule meetings")
    console.log("5. The system will automatically create notifications")

    console.log("\n✅ Database seeding completed!")
  } catch (error) {
    console.error("❌ Error seeding database:", error)
  }
}

// Uncomment to run: seedDatabase()
