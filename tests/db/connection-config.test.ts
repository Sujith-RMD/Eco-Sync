import { describe, expect, it } from "vitest";
import {
  buildDbConnectionConfig,
  withoutSslMode,
} from "../../src/db/connection-config";

const POOLED =
  "postgres://postgres.abc123:secretpw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";
const DIRECT = "postgres://user:pw@db.abc123.supabase.co:5432/postgres?sslmode=require";
const NEON = "postgres://user:pw@ep-x-pooler.us-east-2.aws.neon.tech/db?sslmode=require";
const LOCAL = "postgresql://postgres:pw@127.0.0.1:5432/app_db";

describe("buildDbConnectionConfig", () => {
  it("pins the CA and drops sslmode for Supabase poolers", () => {
    const r = buildDbConnectionConfig(POOLED);
    expect(r.ssl).toBeDefined();
    expect(String(r.ssl && r.ssl.ca)).toContain("BEGIN CERTIFICATE");
    expect(r.connectionString).not.toMatch(/sslmode/i);
  });

  it("covers Supabase direct hosts too, not just poolers", () => {
    const r = buildDbConnectionConfig(DIRECT);
    expect(String(r.ssl && r.ssl.ca)).toContain("BEGIN CERTIFICATE");
    expect(r.connectionString).not.toMatch(/sslmode/i);
  });

  it("leaves every other host to its own connection string", () => {
    for (const url of [NEON, LOCAL]) {
      const r = buildDbConnectionConfig(url);
      expect(r.connectionString).toBe(url);
      expect(r.ssl).toBeUndefined();
    }
  });

  it("keeps credentials and port intact while rewriting the query string", () => {
    const r = buildDbConnectionConfig(POOLED);
    expect(r.connectionString).toBe(
      "postgres://postgres.abc123:secretpw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
    );
  });

  it("survives an unparseable value instead of throwing at module load", () => {
    const r = buildDbConnectionConfig("not a url at all");
    expect(r.connectionString).toBe("not a url at all");
    expect(r.ssl).toBeUndefined();
  });
});

describe("withoutSslMode", () => {
  it("removes the parameter wherever it sits", () => {
    expect(withoutSslMode("postgres://h/db?sslmode=require")).toBe("postgres://h/db");
    expect(withoutSslMode("postgres://h/db?sslmode=require&connect_timeout=5")).toBe(
      "postgres://h/db?connect_timeout=5",
    );
    expect(withoutSslMode("postgres://h/db?a=1&sslmode=verify-full")).toBe(
      "postgres://h/db?a=1",
    );
    expect(withoutSslMode("postgres://h/db?a=1&sslmode=require&b=2")).toBe(
      "postgres://h/db?a=1&b=2",
    );
  });

  it("is case insensitive and leaves other parameters alone", () => {
    expect(withoutSslMode("postgres://h/db?SSLMODE=disable&pool_min=1")).toBe(
      "postgres://h/db?pool_min=1",
    );
    expect(withoutSslMode("postgres://h/db")).toBe("postgres://h/db");
    expect(withoutSslMode("postgres://h/db?application_name=sslmode_test")).toBe(
      "postgres://h/db?application_name=sslmode_test",
    );
  });

  it("never leaves dangling punctuation behind", () => {
    for (const out of [
      withoutSslMode("postgres://h/db?sslmode=require"),
      withoutSslMode("postgres://h/db?sslmode=require&"),
      withoutSslMode("postgres://h/db&a=1&sslmode=require"),
    ]) {
      expect(out).not.toMatch(/[?&]$/);
    }
  });
});
