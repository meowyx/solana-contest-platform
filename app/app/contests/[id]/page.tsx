'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js';
import { WalletButton } from '../../components/WalletButton';
import { getProgram, getEscrowPDA, getSubmissionPDA, getVotePDA } from '../../lib/program';

export default function ContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { connection } = useConnection();
  const wallet = useWallet();
  const [contest, setContest] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [selectedWinner, setSelectedWinner] = useState('');
  const [fundingAmount, setFundingAmount] = useState('');

  useEffect(() => {
    fetchContestData();
  }, [resolvedParams.id, connection]);

  const fetchContestData = async () => {
    try {
      const dummyWallet = {
        publicKey: PublicKey.default,
        signTransaction: async () => { throw new Error('Not implemented'); },
        signAllTransactions: async () => { throw new Error('Not implemented'); },
      } as any as Wallet;

      const provider = new AnchorProvider(
        connection,
        dummyWallet,
        AnchorProvider.defaultOptions()
      );
      const program = getProgram(provider);

      const contestPubkey = new PublicKey(resolvedParams.id);
      const contestData = await (program.account as any).contest.fetch(contestPubkey);
      setContest({ publicKey: contestPubkey, account: contestData });

      // Fetch submissions
      const allSubmissions = await (program.account as any).submission.all([
        {
          memcmp: {
            offset: 8 + 32,
            bytes: contestPubkey.toBase58(),
          },
        },
      ]);
      setSubmissions(allSubmissions);

      // Fetch votes
      const allVotes = await (program.account as any).judgeVoteAccount.all([
        {
          memcmp: {
            offset: 8 + 32,
            bytes: contestPubkey.toBase58(),
          },
        },
      ]);
      setVotes(allVotes);
    } catch (err) {
      console.error('Error fetching contest:', err);
      setError('Failed to load contest');
    } finally {
      setLoading(false);
    }
  };

  const handleFundContest = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !contest) return;

    setActionLoading(true);
    setError('');

    try {
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        AnchorProvider.defaultOptions()
      );
      const program = getProgram(provider);

      const [escrowPDA] = getEscrowPDA(
        contest.account.creator,
        BigInt(contest.account.contestId.toString())
      );

      const tx = await program.methods
        .fundContest()
        .accounts({
          contest: contest.publicKey,
          escrow: escrowPDA,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Contest funded:', tx);
      await fetchContestData();
    } catch (err: any) {
      console.error('Error funding contest:', err);
      setError(err.message || 'Failed to fund contest');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction || !contest) return;

    setActionLoading(true);
    setError('');

    try {
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        AnchorProvider.defaultOptions()
      );
      const program = getProgram(provider);

      const [submissionPDA] = getSubmissionPDA(contest.publicKey, wallet.publicKey);

      const tx = await program.methods
        .submitEntry(submissionUrl)
        .accounts({
          contest: contest.publicKey,
          submission: submissionPDA,
          participant: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Entry submitted:', tx);
      setSubmissionUrl('');
      await fetchContestData();
    } catch (err: any) {
      console.error('Error submitting entry:', err);
      setError(err.message || 'Failed to submit entry');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction || !contest) return;

    setActionLoading(true);
    setError('');

    try {
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        AnchorProvider.defaultOptions()
      );
      const program = getProgram(provider);

      const [votePDA] = getVotePDA(contest.publicKey, wallet.publicKey);
      const winnerPubkey = new PublicKey(selectedWinner);

      const tx = await program.methods
        .judgeVote(winnerPubkey)
        .accounts({
          contest: contest.publicKey,
          vote: votePDA,
          judge: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Vote cast:', tx);
      setSelectedWinner('');
      await fetchContestData();
    } catch (err: any) {
      console.error('Error voting:', err);
      setError(err.message || 'Failed to cast vote');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDistributePrizes = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !contest) return;

    setActionLoading(true);
    setError('');

    try {
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        AnchorProvider.defaultOptions()
      );
      const program = getProgram(provider);

      const [escrowPDA] = getEscrowPDA(
        contest.account.creator,
        BigInt(contest.account.contestId.toString())
      );

      // Find the winner based on votes
      const voteCounts = new Map<string, number>();
      votes.forEach((vote) => {
        const winner = vote.account.winner.toString();
        voteCounts.set(winner, (voteCounts.get(winner) || 0) + 1);
      });

      const winnerEntry = Array.from(voteCounts.entries()).find(
        ([_, count]) => count >= contest.account.approvalThreshold
      );

      if (!winnerEntry) {
        throw new Error('No consensus reached yet');
      }

      const winnerPubkey = new PublicKey(winnerEntry[0]);

      // Get all vote PDAs for remaining accounts
      const voteAccounts = votes.map((v) => ({
        pubkey: v.publicKey,
        isSigner: false,
        isWritable: false,
      }));

      const tx = await program.methods
        .distributePrizes()
        .accounts({
          contest: contest.publicKey,
          escrow: escrowPDA,
          winner: winnerPubkey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(voteAccounts)
        .rpc();

      console.log('Prizes distributed:', tx);
      await fetchContestData();
    } catch (err: any) {
      console.error('Error distributing prizes:', err);
      setError(err.message || 'Failed to distribute prizes');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fef6e4] flex items-center justify-center">
        <div className="card-neo bg-[#8bd3dd]">
          <p className="text-[#001858] font-black text-xl uppercase">Loading contest...</p>
        </div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-[#fef6e4] flex items-center justify-center">
        <div className="card-neo bg-[#ffbe0b] text-center">
          <p className="text-[#001858] font-black mb-4 text-xl uppercase">Contest not found</p>
          <Link href="/contests" className="btn-neo bg-[#f582ae] text-[#001858] inline-block">
            Back to Contests
          </Link>
        </div>
      </div>
    );
  }

  const isCreator = wallet.publicKey?.equals(contest.account.creator);
  const isJudge = wallet.publicKey && contest.account.judges.some((j: PublicKey) => j.equals(wallet.publicKey!));
  const deadline = new Date(contest.account.submissionDeadline.toNumber() * 1000);
  const isBeforeDeadline = new Date() < deadline;
  const statusKey = Object.keys(contest.account.status)[0].toLowerCase();

  return (
    <div className="min-h-screen bg-[#fef6e4]">
      {/* Navigation */}
      <nav className="border-b-4 border-black bg-[#8bd3dd]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-3xl font-black text-[#001858] hover:text-[#f582ae] transition-colors">
              🏆 SOLARENA
            </Link>
            <WalletButton />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/contests" className="text-[#001858] font-black hover:text-[#f582ae] transition-colors text-lg">
            ← BACK TO CONTESTS
          </Link>
        </div>

        {error && (
          <div className="mb-6 card-neo bg-[#f582ae]">
            {error}
          </div>
        )}

        {/* Contest Details */}
        <div className="card-neo bg-[#f582ae] mb-8">
          <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-black text-[#001858] mb-2 uppercase">
                {contest.account.title}
              </h1>
              <p className="text-[#001858] font-bold">{contest.account.description}</p>
            </div>
            <span className={`px-4 py-2 text-sm font-black uppercase border-4 border-black neo-brutalism-shadow ${
              statusKey === 'active' ? 'bg-[#06ffa5] text-[#001858]' :
              statusKey === 'setup' ? 'bg-[#ffbe0b] text-[#001858]' :
              statusKey === 'completed' ? 'bg-[#8bd3dd] text-[#001858]' :
              'bg-[#f3d2c1] text-[#001858]'
            }`}>
              {statusKey.toUpperCase()}
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border-4 border-black p-4 neo-brutalism-shadow">
              <p className="text-[#001858] text-sm mb-1 font-bold uppercase">Prize Amount</p>
              <p className="text-3xl font-black text-[#001858]">
                {(contest.account.prizeAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
              </p>
            </div>
            <div className="bg-white border-4 border-black p-4 neo-brutalism-shadow">
              <p className="text-[#001858] text-sm mb-1 font-bold uppercase">Submissions</p>
              <p className="text-3xl font-black text-[#001858]">
                {contest.account.submissionCount}
              </p>
            </div>
            <div className="bg-white border-4 border-black p-4 neo-brutalism-shadow">
              <p className="text-[#001858] text-sm mb-1 font-bold uppercase">Deadline</p>
              <p className="text-lg font-black text-[#001858]">
                {deadline.toLocaleDateString()}
              </p>
            </div>
            <div className="bg-white border-4 border-black p-4 neo-brutalism-shadow">
              <p className="text-[#001858] text-sm mb-1 font-bold uppercase">Judges</p>
              <p className="text-lg font-black text-[#001858]">
                {contest.account.judges.length} ({contest.account.approvalThreshold} needed)
              </p>
            </div>
          </div>

          {/* Fund Contest (Creator only, if not funded) */}
          {isCreator && !contest.account.funded && statusKey === 'setup' && (
            <div className="mt-6 card-neo bg-[#ffbe0b]">
              <p className="text-[#001858] font-black mb-3 uppercase">⚠️ Contest needs to be funded to activate</p>
              <button
                onClick={handleFundContest}
                disabled={actionLoading}
                className="btn-neo bg-[#06ffa5] text-[#001858]"
              >
                {actionLoading ? 'Funding...' : `Fund Contest (${(contest.account.prizeAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL)`}
              </button>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Submit Entry */}
          {isBeforeDeadline && statusKey === 'active' && wallet.publicKey && (
            <div className="card-neo bg-[#06ffa5]">
              <h2 className="text-2xl font-black text-[#001858] mb-4 uppercase">📝 Submit Entry</h2>
              <form onSubmit={handleSubmitEntry} className="space-y-4">
                <div>
                  <label className="block text-[#001858] font-black mb-2 uppercase text-sm">
                    Submission URL
                  </label>
                  <input
                    type="url"
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                    className="input-neo w-full bg-white text-[#001858] placeholder-gray-500"
                    placeholder="https://github.com/user/project"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading || !wallet.publicKey}
                  className="btn-neo w-full bg-[#f582ae] text-[#001858]"
                >
                  {actionLoading ? 'SUBMITTING...' : 'SUBMIT ENTRY'}
                </button>
              </form>
            </div>
          )}

          {/* Judge Vote */}
          {isJudge && !isBeforeDeadline && statusKey === 'active' && (
            <div className="card-neo bg-[#8bd3dd]">
              <h2 className="text-2xl font-black text-[#001858] mb-4 uppercase">⚖️ Cast Your Vote</h2>
              <form onSubmit={handleVote} className="space-y-4">
                <div>
                  <label className="block text-[#001858] font-black mb-2 uppercase text-sm">
                    Select Winner
                  </label>
                  <select
                    value={selectedWinner}
                    onChange={(e) => setSelectedWinner(e.target.value)}
                    className="input-neo w-full bg-white text-[#001858] font-bold"
                    required
                  >
                    <option value="">Choose a participant...</option>
                    {submissions.map((sub) => (
                      <option key={sub.publicKey.toString()} value={sub.account.participant.toString()}>
                        {sub.account.participant.toString().slice(0, 8)}...
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedWinner}
                  className="btn-neo w-full bg-[#ffbe0b] text-[#001858]"
                >
                  {actionLoading ? 'VOTING...' : 'CAST VOTE'}
                </button>
              </form>
            </div>
          )}

          {/* Distribute Prizes */}
          {!isBeforeDeadline && statusKey === 'active' && votes.length >= contest.account.approvalThreshold && (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-4">Distribute Prizes</h2>
              <p className="text-gray-400 mb-4">
                Consensus reached! Click to distribute prizes to the winner.
              </p>
              <button
                onClick={handleDistributePrizes}
                disabled={actionLoading}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                {actionLoading ? 'Distributing...' : 'Distribute Prizes'}
              </button>
            </div>
          )}
        </div>

        {/* Submissions List */}
        {submissions.length > 0 && (
          <div className="mt-8 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
            <h2 className="text-2xl font-bold text-white mb-4">
              Submissions ({submissions.length})
            </h2>
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div
                  key={sub.publicKey.toString()}
                  className="p-4 bg-white/5 rounded-lg border border-purple-500/10"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-1">
                        {sub.account.participant.toString().slice(0, 16)}...
                      </p>
                      <a
                        href={sub.account.submissionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 break-all"
                      >
                        {sub.account.submissionUrl}
                      </a>
                      <p className="text-gray-400 text-sm mt-2">
                        Submitted: {new Date(sub.account.submittedAt.toNumber() * 1000).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      {votes.filter((v) => v.account.winner.equals(sub.account.participant)).length > 0 && (
                        <span className="text-green-400 text-sm">
                          {votes.filter((v) => v.account.winner.equals(sub.account.participant)).length} vote(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Votes List */}
        {votes.length > 0 && isJudge && (
          <div className="mt-8 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
            <h2 className="text-2xl font-bold text-white mb-4">
              Judge Votes ({votes.length})
            </h2>
            <div className="space-y-2">
              {votes.map((vote) => (
                <div
                  key={vote.publicKey.toString()}
                  className="p-3 bg-white/5 rounded-lg border border-purple-500/10 flex justify-between"
                >
                  <span className="text-gray-400">
                    Judge: {vote.account.judge.toString().slice(0, 16)}...
                  </span>
                  <span className="text-white">
                    Winner: {vote.account.winner.toString().slice(0, 16)}...
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
