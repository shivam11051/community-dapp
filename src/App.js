import { useState, useEffect } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import "./App.css";

const CONTRACT_ADDRESS = "0x723e686dddc509aa4fe1ec872da4a0247b5a6f63";
const INR_RATE = 500000;

const ABI = [
  "function joinGroup() payable",
  "function selectBorrower(address)",
  "function releaseFunds()",
  "function payEMI() payable",
  "function withdrawAllProfit()",
  "function withdrawPartialProfit(uint256)",
  "function getEMI() view returns(uint)",
  "function getEMIinINR() view returns(uint)",
  "function remainingMonths() view returns(uint)",
  "function getPoolBalance() view returns(uint)",
  "function getPoolInINR() view returns(uint)",
  "function getMembers() view returns(address[])",
  "event MemberJoined(address)",
  "event BorrowerSelected(address)",
  "event LoanReleased(address,uint)",
  "event EMIPaid(address,uint,uint)",
  "event ProfitWithdrawn(address,uint)"
];

export default function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [tab, setTab] = useState("overview");
  const [currency, setCurrency] = useState("INR");

  const [borrower, setBorrower] = useState("");
  const [emi, setEmi] = useState("0");
  const [monthsLeft, setMonthsLeft] = useState(12);
  const [pool, setPool] = useState("0");
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    const isMobile = /iPhone|Android/i.test(navigator.userAgent);
    if (isMobile && !window.ethereum) {
      window.location.href = "https://metamask.app.link/dapp/shivam11051.github.io/community-dapp";
    }
  }, []);

  async function connectWallet() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const cont = new Contract(CONTRACT_ADDRESS, ABI, signer);

    setContract(cont);
    setAccount(await signer.getAddress());
    loadAll(cont);
    loadHistory(cont);
  }

  async function loadAll(c) {
    const m = await c.getMembers();
    setMembers(m);

    const r = await c.remainingMonths();
    setMonthsLeft(r.toString());

    if (currency === "INR") {
      setEmi((await c.getEMIinINR()).toString());
      setPool((await c.getPoolInINR()).toString());
    } else {
      setEmi(formatEther(await c.getEMI()));
      setPool(formatEther(await c.getPoolBalance()));
    }
  }

  async function loadHistory(c) {
    const joined = await c.queryFilter("MemberJoined");
    const selected = await c.queryFilter("BorrowerSelected");
    const released = await c.queryFilter("LoanReleased");
    const emis = await c.queryFilter("EMIPaid");
    const profits = await c.queryFilter("ProfitWithdrawn");

    let all = [];

    joined.forEach(e => all.push({ type:"Join", user:e.args[0], eth:"0.01", inr:(0.01*INR_RATE).toFixed(0), block:e.blockNumber }));
    selected.forEach(e => all.push({ type:"Borrower Selected", user:e.args[0], eth:"-", inr:"-", block:e.blockNumber }));
    released.forEach(e => all.push({ type:"Loan", user:e.args[0], eth:formatEther(e.args[1]), inr:(formatEther(e.args[1])*INR_RATE).toFixed(0), block:e.blockNumber }));
    emis.forEach(e => all.push({ type:`EMI ${e.args[2]}`, user:e.args[0], eth:formatEther(e.args[1]), inr:(formatEther(e.args[1])*INR_RATE).toFixed(0), block:e.blockNumber }));
    profits.forEach(e => all.push({ type:"Profit", user:e.args[0], eth:formatEther(e.args[1]), inr:(formatEther(e.args[1])*INR_RATE).toFixed(0), block:e.blockNumber }));

    all.sort((a,b)=>b.block-a.block);
    setHistory(all);
  }

  async function joinGroup() {
    await (await contract.joinGroup({ value: parseEther("0.01") })).wait();
    loadAll(contract); loadHistory(contract);
  }

  async function selectBorrowerFunc() {
    await (await contract.selectBorrower(borrower)).wait();
    loadHistory(contract);
  }

  async function releaseLoan() {
    await (await contract.releaseFunds()).wait();
    loadHistory(contract);
  }

  async function payEMI() {
    const val = await contract.getEMI();
    await (await contract.payEMI({ value: val })).wait();
    loadAll(contract); loadHistory(contract);
  }

  async function withdrawAll() {
    await (await contract.withdrawAllProfit()).wait();
    loadHistory(contract);
  }

  async function withdrawPartial() {
    await (await contract.withdrawPartialProfit(parseEther(withdrawAmount))).wait();
    setWithdrawAmount("");
    loadHistory(contract);
  }

  return (
    <div className="app">
      <div className="glass">
        <div className="topbar">
          <div className="logo">BlockChit</div>
          <div>
            <button onClick={() => setCurrency(currency==="INR"?"ETH":"INR")}>
              View: {currency}
            </button>
            <button onClick={connectWallet}>Connect Wallet</button>
          </div>
        </div>

        <div className="wallet">{account || "Not Connected"}</div>

        <div className="tabs">
          <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>Overview</button>
          <button className={tab==="emi"?"active":""} onClick={()=>setTab("emi")}>EMI</button>
          <button className={tab==="profit"?"active":""} onClick={()=>setTab("profit")}>Profit</button>
          <button className={tab==="transactions"?"active":""} onClick={()=>setTab("transactions")}>Transactions</button>
        </div>

        {tab==="overview" && (
          <div className="panel">
            <p>Members: {members.length}/3</p>
            <p>Total Pool: {currency==="INR"?"₹":""}{pool} {currency==="ETH"?"ETH":""}</p>
            <button onClick={joinGroup}>Join Group</button>

            <input placeholder="Borrower Address" onChange={e=>setBorrower(e.target.value)} />
            <button onClick={selectBorrowerFunc}>Select Borrower</button>
            <button onClick={releaseLoan}>Release Funds</button>
          </div>
        )}

        {tab==="emi" && (
          <div className="panel">
            <p>Monthly EMI: {currency==="INR"?"₹":""}{emi}</p>
            <p>Remaining Months: {monthsLeft}</p>
            <button onClick={payEMI}>Pay EMI</button>
          </div>
        )}

        {tab==="profit" && (
          <div className="panel">
            <input
              placeholder="Withdraw Amount (ETH)"
              value={withdrawAmount}
              onChange={e=>setWithdrawAmount(e.target.value)}
            />
            <button onClick={withdrawPartial}>Withdraw Partial</button>
            <button onClick={withdrawAll}>Withdraw Full Profit</button>
          </div>
        )}

        {tab==="transactions" && (
          <div className="panel">
            <h3>On-Chain Ledger</h3>
            <div className="history">
              {history.map((tx,i)=>(
                <div key={i} className="historyRow">
                  <b>{tx.type}</b><br/>
                  {tx.user.slice(0,6)}...<br/>
                  ETH: {tx.eth}<br/>
                  INR: ₹{tx.inr}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
