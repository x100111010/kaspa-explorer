import moment from "moment";
import { useContext, useEffect, useState } from 'react';
import { Col, Container, Row, Spinner, ToggleButton } from "react-bootstrap";
import { BiGhost } from "react-icons/bi";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import Toggle from "react-toggle";
import { numberWithCommas } from "../helper";
import { getAddressBalance, getAddressUtxos, getBlock, getBlockdagInfo, getTransaction, getTransactions, getTransactionsFromAddress } from '../kaspa-api-client.js';
import CopyButton from "./CopyButton.js";
import PriceContext from "./PriceContext.js";
import UtxoPagination from "./UtxoPagination.js";

const AddressInfoPage = () => {
    const { addr } = useParams();
    return <AddressInfo key={addr} />
}

const AddressInfo = () => {
    const { addr } = useParams();
    const [addressBalance, setAddressBalance] = useState()

    const [view, setView] = useState("transactions")

    const [detailedView, setDetailedView] = useState(false)

    const [utxos, setUtxos] = useState([])
    const [loadingUtxos, setLoadingUtxos] = useState(true)

    const [txs, setTxs] = useState([])
    const [txsOverview, setTxsOverview] = useState([])
    const [txsInpCache, setTxsInpCache] = useState([])
    const [loadingTxs, setLoadingTxs] = useState(true)

    const [errorLoadingUtxos, setErrorLoadingUtxos] = useState(false)
    const [active, setActive] = useState(1)
    const [activeTx, setActiveTx] = useState(1)

    const [currentEpochTime, setCurrentEpochTime] = useState(0);
    const [currentDaaScore, setCurrentDaaScore] = useState(0);

    const { price } = useContext(PriceContext);

    const getAddrFromOutputs = (outputs, i) => {
        for (const o of outputs) {
            if (o.index == i) {
                return o.script_public_key_address
            }
        }
    }
    const getAmountFromOutputs = (outputs, i) => {
        for (const o of outputs) {
            if (o.index == i) {
                return o.amount / 100000000
            }
        }
    }

    const getAmount = (outputs, inputs) => {
        var balance = 0
        for (const o of outputs) {
            if (o.script_public_key_address == addr) {
                balance = balance + o.amount / 100000000
            }
        }
        for (const i of inputs) {
            if (getAddrFromOutputs(txsInpCache[i.previous_outpoint_hash]?.outputs || [], i.previous_outpoint_index) == addr) {
                balance = balance - getAmountFromOutputs(txsInpCache[i.previous_outpoint_hash]["outputs"], i.previous_outpoint_index)
            }
        }
        return balance
    }

    useEffect(() => {
        getAddressBalance(addr).then(
            (res) => {
                setAddressBalance(res)
            }
        )

        getBlockdagInfo().then(
            (blockdag) => {
                getBlock(blockdag.tipHashes[0]).then(
                    (block) => {
                        setCurrentEpochTime(Math.round(parseInt(block.header.timestamp) / 1000))
                        setCurrentDaaScore(parseInt(block.header.daaScore))
                    }
                )
            }
        )

    }, [])

    useEffect(() => {
        setErrorLoadingUtxos(false);
        setLoadingUtxos(true);
    }, [addressBalance])

    useEffect(() => {
        if (view === "transactions") {
            getTransactionsFromAddress(addr).then(res => {
                setTxsOverview(res.transactions)
                getTransactions(res.transactions.map(x => x.tx_received)
                    .concat(res.transactions.map(x => x.tx_sent)).filter(v => v)).then(
                        res => {
                            console.log("prepare", res)
                            getTransactions(res.flatMap(tx => {
                                return tx.inputs.map(inp => {
                                    console.log("inp", inp)
                                    return inp.previous_outpoint_hash
                                })
                            })).then(res_inputs => {

                                var txInpObj = {}

                                res_inputs.forEach(x => txInpObj[x.transaction_id] = x)

                                setTxsInpCache(txInpObj)
                            })
                            setLoadingTxs(false);
                            setTxs(res)
                        }
                    )
            })
                .catch(ex => {
                    setLoadingTxs(false);
                })
        }
        if (view === "utxos") {
            getAddressUtxos(addr).then(
                (res) => {
                    setLoadingUtxos(false);
                    setUtxos(res);
                }
            )
                .catch(ex => {
                    setLoadingUtxos(false);
                    setErrorLoadingUtxos(true);
                })
        }
    }, [view])


    //     <div className="blockinfo-content">
    //     <div className="blockinfo-header"><h3>Details for {addr}</h3></div>
    //     <table className="blockinfo-table">
    //         <tr className="trow">
    //             <td>Balance</td>
    //             <td>{addressBalance/100000000} KAS</td>
    //         </tr>
    //         <tr>
    //             <td>UTXOs</td>
    //             <td>{utxos ? <ul>
    //                 {utxos
    //                 .sort((a,b) => {return b.utxoEntry.blockDaaScore - a.utxoEntry.blockDaaScore})
    //                 .map(x => <li>{x.utxoEntry.amount/100000000} KAS ({x.outpoint.transactionId})</li>)}
    //             </ul> : <>Loading UTXOs <Spinner animation="border" role="status" /></>}</td>
    //         </tr>
    //     </table>
    // </div> : <>Loading Address info <Spinner animation="border" role="status" /></>}

    return <div className="addressinfo-page">
        <Container className="webpage addressinfo-box" fluid>
            <Row>
                <Col xs={12}>
                    <div className="addressinfo-title d-flex flex-row align-items-end">address Overview
                    </div>

                </Col>
            </Row>
            <Row>
                <Col md={12} className="mt-sm-4">

                    <div className="addressinfo-header">Address</div>
                    <div className="utxo-value">{addr}
                        <CopyButton size="2rem" text={addr} /></div>


                </Col>

            </Row>
            <Row>
                <Col sm={6} md={4}>
                    <div className="addressinfo-header mt-4">balance</div>
                    <div className="utxo-value d-flex">
                        {addressBalance !== undefined ? <div className="utxo-amount">+{numberWithCommas(addressBalance / 100000000)} KAS</div> : <Spinner animation="border" variant="primary" />}</div>
                </Col>
                <Col sm={6} md={4}>
                    <div className="addressinfo-header mt-4 ms-sm-5">UTXOs count</div>
                    <div className="utxo-value ms-sm-5">{!loadingUtxos ? utxos.length : <Spinner animation="border" variant="primary" />}{errorLoadingUtxos && <BiGhost className="error-icon" />}</div>
                </Col>
            </Row>
            <Row>
                <Col sm={6} md={4}>
                    <div className="addressinfo-header addressinfo-header-border mt-4 mt-sm-4 pt-sm-4 me-sm-5">value</div>
                    <div className="utxo-value">{(addressBalance / 100000000 * price).toFixed(2)} USD</div>
                </Col>
                <Col sm={6} md={4}>
                    <div className="addressinfo-header addressinfo-header-border mt-4 mt-sm-4 pt-sm-4 ms-sm-5">Transactions count</div>
                    <div className="utxo-value ms-sm-5">{!loadingTxs ? txs.length : <Spinner animation="border" variant="primary" />}{errorLoadingUtxos && <BiGhost className="error-icon" />}</div>
                </Col>
            </Row>
        </Container>

        {view == "transactions" && <Container className="webpage addressinfo-box mt-4" fluid>
            <Row className="border-bottom border-bottom-1">
                <Col xs={6} className="d-flex flex-row align-items-center">
                    <div className="utxo-title d-flex flex-row">Transaction History</div>
                    <div className="ms-auto d-flex flex-row align-items-center"><Toggle
    defaultChecked={true}
    size={"1px"}
    icons={false}
    onChange={() => {setDetailedView(!detailedView)}} /><span className="text-light ms-2">Show details</span></div>
                </Col>
                {txs.length > 10 ? <Col xs={12} sm={6} className="d-flex flex-row justify-items-end">
                    <UtxoPagination active={activeTx} total={Math.ceil(txs.length / 10)} setActive={setActiveTx} />

                </Col> : <></>}
            </Row>
            {!loadingTxs ? txs.slice((activeTx - 1) * 10, (activeTx - 1) * 10 + 10).map((x) =>
                <>
                    <Row className="pb-4 mb-0">
                        <Col sm={7} md={7}>
                            <div className="utxo-header mt-3">transaction id</div>
                            <div className="utxo-value">
                                <Link className="blockinfo-link" to={`/txs/${x.transaction_id}`} >
                                    {x.transaction_id}
                                </Link>
                            </div>
                        </Col>
                        <Col sm={5} md={5}>
                            <div className="utxo-header mt-3">amount</div>
                            <div className="utxo-value">
                                <Link className="blockinfo-link" to={`/txs/${x.transaction_id}`} >
                                    <span className={getAmount(x.outputs, x.inputs) > 0 ? "utxo-amount" : "utxo-amount-minus"}>{getAmount(x.outputs, x.inputs)}&nbsp;KAS</span>
                                </Link>
                            </div>
                        </Col>
                    </Row>
                    {!detailedView &&
                    <Row className="utxo-border pb-4 mb-4">
                        <Col sm={6} md={6}>
                            <div className="utxo-header mt-1">FROM</div>
                            <div className="utxo-value" style={{ fontSize: "smaller" }}>

                                    {x.inputs.map(x => {
                                        return (txsInpCache && txsInpCache[x.previous_outpoint_hash]) ? <>
                                            <Row>
                                                <Col xs={7} className="adressinfo-tx-overflow pb-0">
                                                    <Link className="blockinfo-link" to={`/addresses/${getAddrFromOutputs(txsInpCache[x.previous_outpoint_hash]["outputs"], x.previous_outpoint_index)}`} >
                                                        <span className={getAddrFromOutputs(txsInpCache[x.previous_outpoint_hash]["outputs"], x.previous_outpoint_index) == addr ? "highlight-addr" : ""}>{getAddrFromOutputs(txsInpCache[x.previous_outpoint_hash]["outputs"], x.previous_outpoint_index)}</span>
                                                    </Link>
                                                </Col>
                                                <Col xs={5}><span className="block-utxo-amount-minus">-{getAmountFromOutputs(txsInpCache[x.previous_outpoint_hash]["outputs"], x.previous_outpoint_index)}&nbsp;KAS</span></Col></Row></> : <li>{x.previous_outpoint_hash} #{x.previous_outpoint_index}</li>
                                    })}
                                
                            </div>
                        </Col>
                        <Col sm={6} md={6}>
                            <div className="utxo-header mt-1">TO</div>
                            <div className="utxo-value" style={{ fontSize: "smaller" }}>
                                {x.outputs.map(x => <Row>
                                    <Col xs={7} className="pb-1 adressinfo-tx-overflow">
                                        <Link className="blockinfo-link" to={`/addresses/${x.script_public_key_address}`}>
                                            <span className={x.script_public_key_address == addr ? "highlight-addr" : ""}>
                                                {x.script_public_key_address}
                                            </span>
                                        </Link>
                                    </Col>
                                    <Col xs={5}><span className="block-utxo-amount">+{x.amount / 100000000}&nbsp;KAS</span></Col></Row>)}
                            </div>
                        </Col>
                    </Row>}
                </>
            ) : <Spinner animation="border" variant="primary" />}

        </Container>}
        {view == "utxos" &&
            <Container className="webpage addressinfo-box mt-4" fluid>
                <Row className="border-bottom border-bottom-1">
                    <Col xs={1}>
                        <div className="utxo-title d-flex flex-row">UTXOs</div>
                    </Col>
                    {utxos.length > 10 ? <Col xs={12} sm={11} className="d-flex flex-row justify-items-end">
                        <UtxoPagination active={active} total={Math.ceil(utxos.length / 10)} setActive={setActive} />
                    </Col> : <></>}
                </Row>
                {errorLoadingUtxos && <BiGhost className="error-icon" />}
                {!loadingUtxos ? utxos.sort((a, b) => b.utxoEntry.blockDaaScore - a.utxoEntry.blockDaaScore).slice((active - 1) * 10, (active - 1) * 10 + 10).map((x) =>
                    <Row className="utxo-border pb-4 mb-4">
                        <Col sm={6} md={4}>
                            <div className="utxo-header mt-3">Block DAA Score</div>
                            <div className="utxo-value">{x.utxoEntry.blockDaaScore}<br />({moment(((currentEpochTime) - (currentDaaScore - x.utxoEntry.blockDaaScore)) * 1000).format("YYYY-MM-DD HH:mm:ss")})</div>
                        </Col>
                        <Col sm={6} md={4}>
                            <div className="utxo-header mt-3">amount</div>
                            <div className="utxo-value d-flex flex-row"><div className="utxo-amount">+{numberWithCommas(x.utxoEntry.amount / 100000000)} KAS</div></div>
                        </Col>
                        <Col sm={6} md={4}>
                            <div className="utxo-header mt-3">value</div>
                            <div className="utxo-value">{(x.utxoEntry.amount / 100000000 * price).toFixed(2)} $</div>
                        </Col>
                        <Col sm={6} md={4}>
                            <div className="utxo-header mt-3">index</div>
                            <div className="utxo-value">{x.outpoint.index}</div>
                        </Col>
                        <Col sm={6} md={4}>
                            <div className="utxo-header mt-3">transaction id</div>
                            <div className="utxo-value">
                                <Link className="blockinfo-link" to={`/txs/${x.outpoint.transactionId}`} >
                                    {x.outpoint.transactionId}
                                </Link>

                            </div>
                        </Col>
                        <Col sm={6} md={4}>
                            <div className="utxo-header mt-3">details</div>
                            <div className="utxo-value">Unspent</div>
                        </Col>
                    </Row>
                ) : <Spinner animation="border" variant="primary" />}

            </Container>}

    </div>

}

export default AddressInfoPage;


// Hash	f08eeaff68bc2ba4f2001cda61263549d64fca9a2293b8fabd9ebec2b9882433
// Is Header Only	false
// Blue Score	22632652
// Version	1
// Parents (3)
// caa643e423bb0c326a99f76a2622afef5858fb89fb099d670a4c91cea3b37f20
// c03e33ccafb49806fe3b58b2821e2998409b05c328d9b37e547928b85d562909
// 3c63790b7f8b809ffcf90b429507ec9ecd241d2c3561fc20496de79a24e3a00d
// Merkle Root	784c09ff1331bc9a330c0cef85cc6578261351362240abec875ee8555fbdb8dd
// Accepted Merkle Root	cd75b4e94ee810b0d14c41295607f4a7771a87a610542935943054447a5a9324
// UTXO Commitment	3a480129f8578f0285dd5f4cc25b2ff0ee4828dbfa52e71c237a66befefec4ab
// Timestamp	2022-08-15 19:41:37.000000739
// Bits	1b0754ff, 754ff000000000000000000000000000000000000000000000000
// Nonce	f3b3a7e035c3589
// DAA Score	24136925
// Blue Work	68851a3d36517ab64
// Pruning Point
// d03fcd0ac26fb847a283464c922cbf9c76a88d6129edac5b976f9ee6caee842c
// Transactions (6)
// 10d1c9d9dbb5d7cbd4d5c34e629a6b68cad7b4548bd652ebb54e16355a030d3c
// 87d8770820d9f038706e74b19e302193ac46b916290ce0745da27afc8020e1d2
// b14a788379bf2e6ec6ab85feb605c36bb7be073f915496089f4f9f6d8d11a783
// 517da75098711b66b21de6da8fa47f300bf621b5fee7adf631f90de04c478bb4
// ea3ef1db0e07a4ad7ebaca3140d58842e1a344d5e1da2cd94002b56ba1e0096c
// 4492281822a4dd2f97920fb0f595523361f266796b71bec49a60cb2228f5f1a0
