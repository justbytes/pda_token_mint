import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PdaTokenMint } from '../target/types/pda_token_mint';
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
} from '@solana/spl-token';
import { assert } from 'chai';

describe('pda-token-mint', () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.PdaTokenMint as Program<PdaTokenMint>;
  const provider = program.provider as anchor.AnchorProvider;

  console.log('program id: ', program.programId);

  const [mint, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('mint')],
    program.programId
  );

  const [tokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('token')],
    program.programId
  );

  it('Is initialized!', async () => {
    const tx = await program.methods
      .createMint()
      .accounts({
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });
    console.log('Your transaction signature', tx);

    const mintAccount = await getMint(
      program.provider.connection,
      mint,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    console.log('Mint Account', mintAccount);
  });

  it('Create token account', async () => {
    const tx = await program.methods
      .createTokenAccount()
      .accounts({
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Your transaction signature', tx);

    let tokenAccountInfo;
    try {
      tokenAccountInfo = await getAccount(
        program.provider.connection,
        tokenAccount,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
    } catch (error) {
      console.log('error from getAccount() ', error);
    }

    console.log('Token Account', tokenAccountInfo);
  });

  it('Mints tokens to the correct wallet with the correct amount', async () => {
    const wallet = provider.wallet.publicKey;

    // Use PDA for token account
    const [tokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('token')],
      program.programId
    );

    console.log('Token Account (PDA):', tokenAccount.toString());

    const mintAmount = new anchor.BN(1000000); // 1 token with 6 decimals

    // Check balance before minting
    let accountInfoBefore;
    try {
      accountInfoBefore = await getAccount(
        provider.connection,
        tokenAccount,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
      console.log('Account exists before minting, balance:', accountInfoBefore.amount.toString());
    } catch (error) {
      console.log('Account does not exist before minting or error:', error);
    }

    const balanceBefore = accountInfoBefore
      ? BigInt(accountInfoBefore.amount.toString())
      : BigInt(0);

    // Mint tokens
    const tx = await program.methods
      .mintTokens(mintAmount)
      .accounts({
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Mint transaction signature:', tx);

    // Check balance after minting
    const accountInfoAfter = await getAccount(
      provider.connection,
      tokenAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    console.log('Balance after minting:', accountInfoAfter.amount.toString());
    const balanceAfter = BigInt(accountInfoAfter.amount.toString());

    // Assert correct mint amount
    const actualMintAmount = balanceAfter - balanceBefore;
    assert.equal(
      actualMintAmount.toString(),
      mintAmount.toString(),
      `Expected mint amount ${mintAmount} but got ${actualMintAmount}`
    );

    // Assert correct token account owner
    assert.equal(
      accountInfoAfter.owner.toString(),
      wallet.toString(),
      'Token account has incorrect owner'
    );

    // Assert correct mint
    assert.equal(
      accountInfoAfter.mint.toString(),
      mint.toString(),
      'Token account has incorrect mint'
    );
  });
});
