'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { SystemProgram } from '@solana/web3.js';
import BN from 'bn.js';
import Link from 'next/link';
import { WalletButton } from '../../components/WalletButton';
import { getProgram, getContestPDA } from '../../lib/program';

export default function CreateContest() {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prizeAmount: '',
    deadline: '',
    judges: [''],
    approvalThreshold: 1,
  });

  const handleJudgeChange = (index: number, value: string) => {
    const newJudges = [...formData.judges];
    newJudges[index] = value;
    setFormData({ ...formData, judges: newJudges });
  };

  const addJudge = () => {
    if (formData.judges.length < 5) {
      setFormData({ ...formData, judges: [...formData.judges, ''] });
    }
  };

  const removeJudge = (index: number) => {
    const newJudges = formData.judges.filter((_, i) => i !== index);
    setFormData({ ...formData, judges: newJudges });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setLoading(true);

      // Validate judges
      const validJudges = formData.judges.filter((j) => j.trim() !== '');
      if (validJudges.length === 0) {
        throw new Error('At least one judge is required');
      }

      if (formData.approvalThreshold > validJudges.length) {
        throw new Error(
          'Approval threshold cannot exceed number of judges'
        );
      }

      // Create provider and program
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        AnchorProvider.defaultOptions()
      );
      const program = getProgram(provider);

      // Generate contest ID (timestamp + random)
      const contestId = new BN(Date.now());
      const contestIdBigInt = BigInt(contestId.toString());

      // Convert prize amount to lamports
      const prizeInLamports = new BN(
        parseFloat(formData.prizeAmount) * 1e9
      );

      // Convert deadline to Unix timestamp
      const deadlineTimestamp = new BN(
        Math.floor(new Date(formData.deadline).getTime() / 1000)
      );

      // Parse judge public keys
      const judgePublicKeys = validJudges.map(
        (judge) => new (require('@solana/web3.js').PublicKey)(judge.trim())
      );

      // Get contest PDA
      const [contestPDA] = getContestPDA(wallet.publicKey, contestIdBigInt);

      // Create contest
      const tx = await program.methods
        .createContest(
          contestId,
          formData.title,
          formData.description,
          prizeInLamports,
          deadlineTimestamp,
          judgePublicKeys,
          formData.approvalThreshold
        )
        .accounts({
          contest: contestPDA,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Contest created:', tx);
      router.push(`/contests/${contestPDA.toBase58()}`);
    } catch (err: any) {
      console.error('Error creating contest:', err);
      setError(err.message || 'Failed to create contest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      {/* Navigation */}
      <nav className="border-b border-purple-700/30 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-white">
              🏆 SolArena
            </Link>
            <WalletButton />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link
              href="/"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20">
            <h1 className="text-3xl font-bold text-white mb-6">
              Create a Contest
            </h1>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="My Awesome Hackathon"
                  maxLength={100}
                  required
                />
                <p className="text-sm text-gray-400 mt-1">
                  Max 100 characters
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 h-32"
                  placeholder="Build the best DeFi app on Solana..."
                  maxLength={500}
                  required
                />
                <p className="text-sm text-gray-400 mt-1">
                  Max 500 characters
                </p>
              </div>

              {/* Prize Amount */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Prize Amount (SOL) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.prizeAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, prizeAmount: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="1.0"
                  required
                />
                <p className="text-sm text-gray-400 mt-1">
                  Minimum: 0.01 SOL
                </p>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Submission Deadline <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* Judges */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Judges <span className="text-red-400">*</span>
                </label>
                {formData.judges.map((judge, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={judge}
                      onChange={(e) => handleJudgeChange(index, e.target.value)}
                      className="flex-1 px-4 py-2 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                      placeholder="Judge's wallet address"
                    />
                    {formData.judges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeJudge(index)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {formData.judges.length < 5 && (
                  <button
                    type="button"
                    onClick={addJudge}
                    className="mt-2 text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    + Add Judge
                  </button>
                )}
                <p className="text-sm text-gray-400 mt-1">
                  Maximum 5 judges
                </p>
              </div>

              {/* Approval Threshold */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Approval Threshold <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={formData.judges.filter((j) => j.trim()).length || 1}
                  value={formData.approvalThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      approvalThreshold: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  required
                />
                <p className="text-sm text-gray-400 mt-1">
                  Number of judges needed to reach consensus
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !wallet.publicKey}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {loading
                  ? 'Creating Contest...'
                  : !wallet.publicKey
                  ? 'Connect Wallet to Create'
                  : 'Create Contest'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
