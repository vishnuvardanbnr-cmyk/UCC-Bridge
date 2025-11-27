import Head from 'next/head';
import TransactionHistory from '../components/TransactionHistory';

export default function Transactions() {
  return (
    <>
      <Head>
        <title>Transaction History - USDT Bridge</title>
        <meta name="description" content="View your bridge transaction history" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossOrigin="anonymous" referrerPolicy="no-referrer" />
      </Head>
      <TransactionHistory />
    </>
  );
}