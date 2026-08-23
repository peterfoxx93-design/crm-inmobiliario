import { describe, expect, it } from "vitest";

import type {
  Activity,
  ActivityType,
  Agency,
  Contact,
  ContactStatus,
  ContactType,
  Deal,
  DealStage,
  LeadSource,
  OperationType,
  Profile,
  ProfileRole,
  Property,
  PropertyImage,
  PropertyStatus,
  PropertyType,
} from "@/lib/types";

describe("tipos de fila (compilan contra el esquema)", () => {
  it("acepta una fila Property valida", () => {
    const status: PropertyStatus = "activo";
    const propertyType: PropertyType = "piso";
    const operation: OperationType = "venta";
    const property: Property = {
      id: "00000000-0000-0000-0000-000000000001",
      agency_id: "00000000-0000-0000-0000-000000000002",
      reference: "REF-0001",
      title: "Piso luminoso en Centro",
      description: null,
      property_type: propertyType,
      operation,
      status,
      price: 250000,
      bedrooms: 3,
      bathrooms: 2,
      surface_m2: 95.5,
      address: "Calle Mayor 1",
      city: "Madrid",
      zone: "Centro",
      lat: 40.416775,
      lng: -3.70379,
      features: ["piscina", "garaje"],
      created_by: null,
      created_at: "2026-01-01T10:00:00Z",
      updated_at: "2026-01-01T10:00:00Z",
    };
    expect(property.status).toBe("activo");
  });

  it("acepta filas Contact, Deal, Activity, PropertyImage, Agency y Profile", () => {
    const agencyId = "00000000-0000-0000-0000-000000000002";

    const agency: Agency = {
      id: agencyId,
      name: "Demo Inmobiliaria",
      slug: "demo",
      logo_url: null,
      primary_color: "#2563eb",
      active: true,
      settings: { sla_lead_hours: 24 },
      created_at: "2026-01-01T10:00:00Z",
      updated_at: "2026-01-01T10:00:00Z",
    };
    expect(agency.slug).toBe("demo");

    const role: ProfileRole = "agent";
    const profile: Profile = {
      id: "00000000-0000-0000-0000-000000000003",
      agency_id: agencyId,
      active_agency_id: null,
      role,
      full_name: "Agente Demo",
      avatar_url: null,
      phone: null,
      created_at: "2026-01-01T10:00:00Z",
      updated_at: "2026-01-01T10:00:00Z",
    };
    expect(profile.role).toBe("agent");

    const contactType: ContactType = "comprador";
    const source: LeadSource = "web";
    const contactStatus: ContactStatus = "nuevo";
    const contact: Contact = {
      id: "00000000-0000-0000-0000-000000000004",
      agency_id: agencyId,
      contact_type: contactType,
      full_name: "Cliente Demo",
      email: "cliente@demo.es",
      phone: "+34600000000",
      notes: null,
      source,
      source_detail: null,
      status: contactStatus,
      budget_max: 300000,
      preferences: {},
      consent_rgpd: false,
      consent_at: null,
      assigned_to: profile.id,
      created_by: profile.id,
      created_at: "2026-01-01T10:00:00Z",
      updated_at: "2026-01-01T10:00:00Z",
    };
    expect(contact.status).toBe("nuevo");

    const stage: DealStage = "nuevo_lead";
    const deal: Deal = {
      id: "00000000-0000-0000-0000-000000000005",
      agency_id: agencyId,
      contact_id: contact.id,
      property_id: null,
      agent_id: profile.id,
      stage,
      value: null,
      notes: null,
      won: null,
      lost_reason: null,
      stage_updated_at: "2026-01-01T10:00:00Z",
      created_at: "2026-01-01T10:00:00Z",
      updated_at: "2026-01-01T10:00:00Z",
    };
    expect(deal.stage).toBe("nuevo_lead");

    const activityType: ActivityType = "llamada";
    const activity: Activity = {
      id: "00000000-0000-0000-0000-000000000006",
      agency_id: agencyId,
      contact_id: contact.id,
      deal_id: deal.id,
      property_id: null,
      type: activityType,
      title: "Primera llamada",
      body: null,
      due_date: null,
      completed_at: null,
      created_by: profile.id,
      created_at: "2026-01-01T10:00:00Z",
    };
    expect(activity.type).toBe("llamada");

    const image: PropertyImage = {
      id: "00000000-0000-0000-0000-000000000007",
      property_id: "00000000-0000-0000-0000-000000000001",
      url: "https://example.com/foto.jpg",
      position: 0,
    };
    expect(image.position).toBe(0);
  });
});
