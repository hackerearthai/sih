const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentRegistry", function () {
  async function deployFixture() {
    const [admin, uploader, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DocumentRegistry");
    const registry = await Factory.deploy(admin.address);
    await registry.waitForDeployment();

    await registry.grantUploaderRole(uploader.address);

    return { registry, admin, uploader, other };
  }

  it("registers a document successfully", async function () {
    const { registry, uploader } = await deployFixture();

    await expect(
      registry
        .connect(uploader)
        .registerDocument(
          "550e8400-e29b-41d4-a716-446655440000",
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "INV-001"
        )
    ).to.emit(registry, "DocumentRegistered");

    const doc = await registry.getDocument(
      "550e8400-e29b-41d4-a716-446655440000"
    );

    expect(doc.docHash).to.equal(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(doc.currentVersion).to.equal(1);
  });

  it("rejects duplicate docId", async function () {
    const { registry, uploader } = await deployFixture();
    const docId = "550e8400-e29b-41d4-a716-446655440000";

    await registry
      .connect(uploader)
      .registerDocument(docId, "hash1", "INV-001");

    await expect(
      registry.connect(uploader).registerDocument(docId, "hash2", "INV-002")
    ).to.be.revertedWith("Document already exists");
  });

  it("chains versions without deleting the old version", async function () {
    const { registry, uploader } = await deployFixture();
    const docId = "550e8400-e29b-41d4-a716-446655440000";

    await registry
      .connect(uploader)
      .registerDocument(docId, "hash1", "INV-001");

    await registry
      .connect(uploader)
      .addVersion(docId, "hash2", "corrected_scan", "INV-001");

    const doc = await registry.getDocument(docId);
    expect(doc.currentVersion).to.equal(2);
    expect(doc.docHash).to.equal("hash2");

    const [versions] = await registry.getDocumentHistory(docId);
    expect(versions.length).to.equal(2);
    expect(versions[0].docHash).to.equal("hash1");
    expect(versions[1].docHash).to.equal("hash2");
  });

  it("detects a hash mismatch", async function () {
    const { registry, uploader } = await deployFixture();
    const docId = "550e8400-e29b-41d4-a716-446655440000";

    await registry
      .connect(uploader)
      .registerDocument(docId, "correct-hash", "INV-001");

    const [valid, stored] = await registry.verifyDocument(
      docId,
      "modified-hash"
    );

    expect(valid).to.equal(false);
    expect(stored).to.equal("correct-hash");
  });

  it("logs access", async function () {
    const { registry, uploader, other } = await deployFixture();
    const docId = "550e8400-e29b-41d4-a716-446655440000";

    await registry
      .connect(uploader)
      .registerDocument(docId, "hash1", "INV-001");

    await expect(
      registry.connect(other).logAccess(docId, "COURT-001", "view")
    ).to.emit(registry, "AccessLogged");

    const [, logs] = await registry.getDocumentHistory(docId);
    expect(logs.length).to.equal(1);
    expect(logs[0].userId).to.equal("COURT-001");
    expect(logs[0].action).to.equal("view");
  });
});
