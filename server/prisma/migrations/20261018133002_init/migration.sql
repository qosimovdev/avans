-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "position" VARCHAR(100),
    "employmentStartDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryHistory" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "monthlySalary" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE INDEX "SalaryHistory_employeeId_effectiveFrom_idx" ON "SalaryHistory"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryHistory_employeeId_effectiveFrom_key" ON "SalaryHistory"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Advance_date_idx" ON "Advance"("date");

-- CreateIndex
CREATE INDEX "Advance_employeeId_date_idx" ON "Advance"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business-rule constraints
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_salary_nonnegative" CHECK ("monthlySalary" >= 0);
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_from_first_of_month" CHECK (EXTRACT(DAY FROM "effectiveFrom") = 1);
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_period_valid" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
