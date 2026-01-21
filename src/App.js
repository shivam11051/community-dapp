import { useState, useEffect } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import "./App.css";

const CONTRACT_ADDRESS = "0xaa59665be7ef152080d474293ce112292a4f0515";

const ABI = [
  "function joinGroup() payable",
  "function selectBorrower(address)",
  "function releaseFunds()",
  "function payEMI() payable",
  "function withdrawProfit()",
  "function getEMI() view returns(uint)",
  "function remainingMonths() view returns(uint)",
  "function getPoolBalance() view returns(uint)",
  "function getMembers() view returns(address[])",
  "event MemberJoined(address)",
  "event BorrowerSelected(address)",
  "event LoanReleased(address,uint)",
  "event EMIPaid(address,uint,uint)",
  "event ProfitWithdrawn(address,uint)"
];

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [tab, setTab] = useState("overview");

  const [borrower, setBorrower] = useState("");
  const [emi, setEmi] = useState("0");
  const [monthsLeft, setMonthsLeft] = useState(12);
  const [pool, setPool] = useState("0");
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState([]);

  // Mobile MetaMask deep link
  useEffect(() => {
    const isMobile = /iPhone|Android/i.test(navigator.userAgent);
    if (isMobile && !window.ethereum) {
      window.location.href = "https://metamask.app.link/dapp/shivam11051.github.io/community-dapp";
    }
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please open in MetaMask browser or install MetaMask.");
      return;
    }
    const prov = new BrowserProvider(window.ethereum);
    
    const sign = await prov.getSigner();
    const addr = await sign.getAddress();
    const cont = new Contract(CONTRACT_ADDRESS, ABI, sign);

    setProvider(prov);
    setSigner(sign);
    setAccount(addr);
    setContract(cont);

    loadOverview(cont);
    loadEMI(cont);
    loadHistory(cont);
  }

  async function joinGroup() {
    const tx = await contract.joinGroup({ value: parseEther("0.01") });
    await tx.wait();
    loadOverview(contract);
  }

  async function selectBorrowerFunc() {
    const tx = await contract.selectBorrower(borrower);
    await tx.wait();
    alert("Borrower Selected");
  }

  async function releaseLoan() {
    const tx = await contract.releaseFunds();
    await tx.wait();
    alert("Loan Released");
  }

  async function payEMI() {
    const amount = await contract.getEMI();
    const tx = await contract.payEMI({ value: amount });
    await tx.wait();
    loadEMI(contract);
    loadHistory(contract);
  }

  async function withdrawProfit() {
    const tx = await contract.withdrawProfit();
    await tx.wait();
    alert("Profit Withdrawn");
  }

  async function loadOverview(c) {
    const m = await c.getMembers();
    const p = await c.getPoolBalance();
    setMembers(m);
    setPool(formatEther(p));
  }

  async function loadEMI(c) {
    const e = await c.getEMI();
    const r = await c.remainingMonths();
    setEmi(formatEther(e));
    setMonthsLeft(r.toString());
  }

  async function loadHistory(c) {
    const joined = await c.queryFilter("MemberJoined");
    const borrowerSel = await c.queryFilter("BorrowerSelected");
    const released = await c.queryFilter("LoanReleased");
    const emis = await c.queryFilter("EMIPaid");
    const profits = await c.queryFilter("ProfitWithdrawn");
  
    let logs = [];
  
    joined.forEach(e => logs.push({
      type: "Joined Group",
      user: e.args[0],
      info: ""
    }));
  
    borrowerSel.forEach(e => logs.push({
      type: "Borrower Selected",
      user: e.args[0],
      info: ""
    }));
  
    released.forEach(e => logs.push({
      type: "Loan Released",
      user: e.args[0],
      info: formatEther(e.args[1]) + " ETH"
    }));
  
    emis.forEach(e => logs.push({
      type: "EMI Paid (Month " + e.args[2] + ")",
      user: e.args[0],
      info: formatEther(e.args[1]) + " ETH"
    }));
  
    profits.forEach(e => logs.push({
      type: "Profit Withdrawn",
      user: e.args[0],
      info: formatEther(e.args[1]) + " ETH"
    }));
  
    setHistory(logs.reverse());
  }
  

  const progress = ((12 - monthsLeft) / 12) * 100;

  return (
    <div className="app">
      <div className="glass">
        <div className="topbar">
          <div className="logo">BlockChit</div>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
        <div className="wallet">{account || "Not Connected"}</div>

        <div className="tabs">
          <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>Overview</button>
          <button className={tab==="emi"?"active":""} onClick={()=>setTab("emi")}>EMI</button>
          <button className={tab==="profit"?"active":""} onClick={()=>setTab("profit")}>Profit</button>
          <button className={tab==="transactions"?"active":""} onClick={()=>setTab("transactions")}>Transactions</button>
        </div>

        {tab === "overview" && (
          <div className="panel">
            <h3>Group Overview</h3>
            <p>Members Joined: {members.length}/3</p>
            <p>Total Pool: {pool} ETH</p>
            <button onClick={joinGroup}>Join Group (0.01 ETH)</button>

            <h3>Select Borrower</h3>
            <input
              placeholder="Borrower Address"
              value={borrower}
              onChange={e => setBorrower(e.target.value)}
            />
            <button onClick={selectBorrowerFunc}>Confirm Borrower</button>
            <button onClick={releaseLoan}>Release Loan</button>
          </div>
        )}

        {tab === "emi" && (
          <div className="panel">
            <h3>EMI Dashboard</h3>
            <p>Monthly EMI: {emi} ETH</p>
            <p>Remaining Months: {monthsLeft} / 12</p>

            <div className="progress">
              <div className="bar" style={{ width: `${progress}%` }}></div>
            </div>

            <button onClick={payEMI}>Pay EMI</button>
          </div>
        )}

        {tab === "profit" && (
          <div className="panel">
            <h3>Profit Pool</h3>
            <p>Current Contract Balance: {pool} ETH</p>
            <p>Estimated Share per Member: {(pool/3).toFixed(4)} ETH</p>
            <button onClick={withdrawProfit}>Withdraw Profit</button>
          </div>
        )}

        {tab === "transactions" && (
          <div className="panel">
            <h3>On-Chain Transactions</h3>
            <div className="history">
              {history.map((tx, i) => (
  <div key={i} className="historyRow">
    <b>{tx.type}</b><br />
    {tx.user.slice(0, 6)}... {tx.info}
  </div>
))}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
