/* global db, print */
// MongoDB initialization script for Docker
// This script runs in MongoDB shell context where 'db' and 'print' are global variables

const ecommerceDB = db.getSiblingDB("ecommerce")

// Create collections with validation
ecommerceDB.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "password"],
      properties: {
        name: { bsonType: "string" },
        email: { bsonType: "string" },
        password: { bsonType: "string" },
        role: { enum: ["customer", "admin"] },
      },
    },
  },
})

ecommerceDB.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "price", "category"],
      properties: {
        name: { bsonType: "string" },
        price: { bsonType: "number", minimum: 0 },
        stock: { bsonType: "number", minimum: 0 },
      },
    },
  },
})

ecommerceDB.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user", "status"],
      properties: {
        user: { bsonType: "objectId" },
        status: { bsonType: "string" },
        createdAt: { bsonType: "date" },
      },
    },
  },
})

ecommerceDB.createCollection("categories", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "slug"],
      properties: {
        name: { bsonType: "string" },
        slug: { bsonType: "string" },
      },
    },
  },
})

// Create indexes for better performance
ecommerceDB.users.createIndex({ email: 1 }, { unique: true })
ecommerceDB.users.createIndex({ role: 1 })

ecommerceDB.products.createIndex({ name: "text", description: "text" })
ecommerceDB.products.createIndex({ category: 1 })
ecommerceDB.products.createIndex({ price: 1 })
ecommerceDB.products.createIndex({ stock: 1 })
ecommerceDB.products.createIndex({ createdAt: -1 })

ecommerceDB.orders.createIndex({ user: 1 })
ecommerceDB.orders.createIndex({ status: 1 })
ecommerceDB.orders.createIndex({ createdAt: -1 })

ecommerceDB.categories.createIndex({ name: 1 }, { unique: true })
ecommerceDB.categories.createIndex({ slug: 1 }, { unique: true })

print("Database initialized successfully with collections and indexes")
