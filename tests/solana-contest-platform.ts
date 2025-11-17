import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solarena } from "../target/types/solarena";

describe("solarena", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.solarena as Program<Solarena>;

  it("Is initialized!", async () => {
    // Add your test here.
    // Tests will be added for SolArena instructions
    console.log("Program ID:", program.programId.toString());
  });
});
