const { PrismaClient } = require('@prisma/client');

const PUBLIC_USER = {
  id: true, username: true, name: true, email: true, homeAddress: true,
  createdAt: true, updatedAt: true,
  creditCards: { select: { id: true, last4: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
};

function createProfileRepository(prisma = new PrismaClient()) {
  return {
    findCredentials: (username) => prisma.user.findUnique({
      where: { username }, select: { id: true, username: true, passwordHash: true },
    }),
    create: (data) => prisma.user.create({ data, select: PUBLIC_USER }),
    get: (username) => prisma.user.findUnique({ where: { username }, select: PUBLIC_USER }),
    update: (id, data) => prisma.user.update({ where: { id }, data, select: PUBLIC_USER }),
    addCard: (userId, last4) => prisma.creditCard.create({
      data: { userId, last4 }, select: { id: true, last4: true, createdAt: true },
    }),
  };
}

module.exports = { createProfileRepository };
