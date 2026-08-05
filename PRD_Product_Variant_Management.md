# Product Requirements Document (PRD)

# Feature: Product Variant Management

## 1. Overview

### Objective

Build a scalable Product Variant Management feature for an ERP/POS
system serving electrical and plumbing supply stores.

The solution must support products such as: - PVC pipes - Electrical
wires - Circuit breakers (MCB/MCCB) - Switches & sockets - LED lights -
Water valves - Plumbing accessories

The design goal is to manage a single product with multiple variants
instead of creating duplicate products for every specification.

------------------------------------------------------------------------

## 2. Goals

-   One Product can contain multiple Variants.
-   Inventory is managed at Variant level.
-   Pricing is managed at Variant level.
-   Barcode belongs to a Variant.
-   Product stores common information.
-   Variant stores specification-specific information.
-   Support more than 100,000 SKUs.

------------------------------------------------------------------------

## 3. Business Value

### Business

-   Reduce duplicated product master data.
-   Faster product maintenance.
-   Easier pricing updates.
-   Better inventory accuracy.
-   Scalable catalog.

### Users

-   Faster product search.
-   Fewer clicks.
-   Easier sales operations.
-   Lower risk of selecting the wrong SKU.

------------------------------------------------------------------------

## 4. Functional Scope

### Product

Fields: - Name - Brand - Category - Description - Images - Status

### Attributes

Examples: - Diameter - Size - Color - Watt - Current - Length - Material

### Attribute Values

Example: Diameter - 21 mm - 27 mm - 34 mm

### Product Attributes

Define which attributes are applicable to each product.

Example: PVC Pipe - Diameter - Class - Length

### Variants

Each Variant contains: - SKU - Barcode - Selling Price - Cost Price -
Stock - Weight - Image - Status

Each Variant represents one unique attribute combination.

Example:

  Diameter   Class   Length
  ---------- ------- --------
  21         B       4m
  21         C       4m
  27         B       4m
  27         C       4m

------------------------------------------------------------------------

## 5. Variant Generation

Users can: - Select attribute values. - Generate all possible
combinations. - Delete unwanted combinations. - Disable combinations. -
Create variants manually.

Duplicate combinations are not allowed.

------------------------------------------------------------------------

## 6. User Experience

### Product Detail

Tabs: - General - Variants - Inventory - Pricing

### Variant Management

Top section: - Attribute selection - Generate Variants button

Below: Editable grid containing: - Image - Variant Name - SKU -
Barcode - Selling Price - Cost Price - Stock - Status

Inline editing is required.

Bulk editing is required.

------------------------------------------------------------------------

## 7. Search

Search indexes: - Product Name - Variant Name - SKU - Barcode - Brand -
Category - Attribute Values

Example:

Searching "PVC 21"

Returns: - PVC Pipe 21 mm Class B - PVC Pipe 21 mm Class C

Typing "Cadivi 2.5"

Returns: - Cadivi Wire 2.5 mm Blue - Cadivi Wire 2.5 mm Red

Selecting a result immediately adds the exact Variant into the sales
document.

------------------------------------------------------------------------

## 8. Inventory

Inventory is managed only at Variant level.

Each Variant maintains: - On Hand - Reserved - Available

Inventory transactions always reference Variant.

------------------------------------------------------------------------

## 9. Pricing

Each Variant has independent: - Cost Price - Selling Price

------------------------------------------------------------------------

## 10. Barcode

Each Variant has a unique barcode.

Barcode scanning must immediately identify the Variant.

------------------------------------------------------------------------

## 11. Business Rules

-   SKU must be unique.
-   Barcode must be unique.
-   Duplicate variant combinations are prohibited.
-   Product attributes cannot be duplicated.
-   Attribute values can be reordered.
-   Disabled variants cannot be sold.
-   Historical variants cannot be physically deleted.
-   Variant names are auto-generated but editable.

------------------------------------------------------------------------

## 12. Non-functional Requirements

-   Support 100,000+ variants.
-   Search response \<300 ms.
-   Server-side pagination.
-   Infinite scrolling.
-   Lazy loading.
-   Bulk import/export.
-   Responsive UI.
-   Keyboard-friendly navigation.

------------------------------------------------------------------------

## 13. Data Model

    Brand
     └── Category
          └── Product
               ├── Product Attribute
               ├── Variant
               │     ├── SKU
               │     ├── Barcode
               │     ├── Price
               │     ├── Stock
               │     └── Variant Attribute Values
               └── Images

------------------------------------------------------------------------

## 14. Deliverables

The implementation should include: 1. Database schema 2. Entity
relationship model 3. REST APIs 4. Frontend UI 5. Variant generation
engine 6. Validation rules 7. Search engine integration 8. Inventory
integration 9. Pricing integration 10. Barcode support 11. Unit tests
12. Integration tests 13. Clean Architecture / DDD 14. Production-ready
source code
