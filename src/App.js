import { useState, useEffect } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import "./App.css";

const CONTRACT_ADDRESS = "0x8435b27ba6f2acdf0e7b4c552a4a2af71dd69941";

const ABI = [
  "function joinGroup() payable",
  "function selectBorrower(address)",
  "function releaseFunds()",
  "function payEMI() payable",
  "function withdrawProfit()",
  "function getEMI() view returns(uint)",
  "function getEMIinINR() view returns(uint)",
  "function remainingMonths() view returns(uint)",
  "function getPoolBalance() view returns(uint)",
  "function getPoolInINR() view returns(uint)",
  "function getMemberShareInINR() view returns(uint)",
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

  useEffect(() => {
    const isMobile = /iPhone|Android/i.test(navigator.userAgent);
    if (isMobile && !window.ethereum) {
      window.location.href = "https://metamask.app.link/dapp/shivam11051.github.io/community-dapp";
    }
  }, []);

  async function connectWallet() {
    if (!window.ethereum) return alert("Install MetaMask");
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const cont = new Contract(CONTRACT_ADDRESS, ABI, signer);

    setContract(cont);
    setAccount(await signer.getAddress());
    loadAll(cont);
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

    const events = await c.queryFilter("*", 0, "latest");
    const logs = events.reverse().map(e => ({
      name: e.eventName,
      user: e.args[0],
      value: e.args[1] ? formatEther(e.args[1]) : ""
    }));
    setHistory(logs);
  }

  async function joinGroup() {
    await (await contract.joinGroup({ value: parseEther("0.01") })).wait();
    loadAll(contract);
  }

  async function selectBorrowerFunc() {
    await (await contract.selectBorrower(borrower)).wait();
  }

  async function releaseLoan() {
    await (await contract.releaseFunds()).wait();
  }

  async function payEMI() {
    const val = await contract.getEMI();
    await (await contract.payEMI({ value: val })).wait();
    loadAll(contract);
  }

  async function withdrawProfit() {
    await (await contract.withdrawProfit()).wait();
  }

  return (
    <div className="app">
      <div className="glass">
        <div className="topbar">
          <div className="logo">BlockChit</div>
          <div>
            <button onClick={() => setCurrency(currency === "INR" ? "ETH" : "INR")}>
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
            <p>Per Member Share: {currency==="INR"?"₹":""}{(pool/3).toFixed(2)}</p>
            <button onClick={withdrawProfit}>Withdraw Profit</button>
          </div>
        )}

        {tab==="transactions" && (
          <div className="panel">
            <div className="history">
              {history.map((tx,i)=>(
                <div key={i} className="historyRow">
                  <b>{tx.name}</b><br/>
                  {tx.user?.slice(0,6)}... {tx.value}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
