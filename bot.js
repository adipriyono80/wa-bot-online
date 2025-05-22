// Import library
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');

// Inisialisasi client
const client = new Client();

// Variabel untuk menyimpan produk dan jawaban
let daftarHarga = {};
let jawabanAutoReply = {};
let jawabanKeyword = {};

// Mapping alias produk untuk parsing kalimat alami
const aliasProduk = {
    'risol': 'risol rogut ayam',
    'pastel': 'pastel sayur',
    'sosis': 'sosis solo',
    'tahu': 'tahu isi',
    'sarang sosis': 'tahu sarang sosis',
    'mayo': 'risol mayo',
    'roti abon': 'roti goreng abon',
    'donat': 'donut',
    'sus': 'sus',
    'pie': 'pie buah',
    'lemper': 'lemper ayam',
    'bugis': 'bugis mandi',
    'onde': 'onde2',
    'nona': 'nona manis',
    'dadar': 'dadar gulung',
    'nagasari': 'nagasari',
    'singkong': 'lapis singkong',
    'bika ambon': 'bika ambon mini'
};

// Fungsi kapitalisasi dan format Rupiah
function capitalize(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

function formatRupiah(angka) {
    return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Fungsi baca file JSON
function muatData() {
    try {
        const produkData = fs.readFileSync(path.join(__dirname, 'produk.json'));
        const jawabanData = fs.readFileSync(path.join(__dirname, 'jawaban.json'));

        daftarHarga = JSON.parse(produkData);
        const jawabanJson = JSON.parse(jawabanData);

        jawabanAutoReply = jawabanJson.auto_reply || {};
        jawabanKeyword = jawabanJson.keyword_reply || {};
    } catch (err) {
        console.error("Gagal membaca file JSON:", err.message);
        process.exit(1);
    }
}

muatData(); // Muat data awal

// Menampilkan QR Code
client.on('qr', (qr) => {
    console.log('Silakan pindai QR Code:');
    qrcode.generate(qr, { small: true });
});

// Saat bot siap
client.on('ready', () => {
    console.log('Bot siap menerima pesan!');
});

// Fungsi pendukung: deteksi awal apakah pesan mengandung nama produk atau alias
function adaProdukDalamPesan(pesan) {
    const listProduk = Object.keys(daftarHarga);

    for (let alias in aliasProduk) {
        const regex = new RegExp(`\\b${alias}\\b`, 'gi');
        if (regex.test(pesan)) return true;
    }

    return listProduk.some(prod => {
        const regex = new RegExp(`\\b${prod.replace(/\s+/g, '\\s+')}\b`, 'gi');
        return regex.test(pesan);
    });
}

// Fungsi Hitung Pesanan
function hitungTotal(pesan) {
    let total = 0;
    const hasil = [];

    const lines = pesan.toLowerCase().replace(/[^a-z0-9\s]/gi, '').split('\n');

    for (let line of lines) {
        // Deteksi dari alias produk
        for (let alias in aliasProduk) {
            const regex = new RegExp(`\\b(${alias})\\b\\s*(?:di|ke|porsi|biji|buah|pcs|pc|pack)?\\s*(\\d+)`, 'gi');
            let match;

            while ((match = regex.exec(line)) !== null) {
                const asliNama = aliasProduk[match[1].trim()];
                const jumlah = parseInt(match[2]);
                const harga = daftarHarga[asliNama];

                if (harga) {
                    const subtotal = jumlah * harga;
                    total += subtotal;
                    hasil.push({ nama: asliNama, jumlah, harga, subtotal });
                }
            }
        }

        // Deteksi langsung dari nama produk
        const listProduk = Object.keys(daftarHarga).join('|');
        const regexUtuh = new RegExp(`\\b(${listProduk})\\b\\s*(?:di|ke|porsi|biji|buah|pcs|pc|pack)?\\s*(\\d+)`, 'gi');

        let match;
        while ((match = regexUtuh.exec(line)) !== null) {
            const namaBarang = match[1].trim();
            const jumlah = parseInt(match[2]);
            const harga = daftarHarga[namaBarang];

            if (harga) {
                const subtotal = jumlah * harga;
                total += subtotal;
                hasil.push({ nama: namaBarang, jumlah, harga, subtotal });
            }
        }
    }

    return { hasil, total };
}

// Terima pesan masuk
client.on('message', async (msg) => {
    const isiPesan = msg.body.toLowerCase().trim();

    // Cek apakah pesan adalah format pesanan
    if (isiPesan.includes('pesan:') || adaProdukDalamPesan(isiPesan)) {
        const { hasil, total } = hitungTotal(msg.body);
        if (hasil.length > 0) {
            let balasan = "Pesanan Anda:\n";

            for (const item of hasil) {
                balasan += `- ${capitalize(item.nama)} (${item.jumlah} x Rp${formatRupiah(item.harga)}) = Rp${formatRupiah(item.subtotal)}\n`;
            }

            balasan += `\nTotal: Rp${formatRupiah(total)}\n\n`;
            balasan += "Silakan transfer ke:\n";
            balasan += "BSI 1002141357 | Mandiri 1050014565638 | BRI 763101011363536\n";
            balasan += "a.n. Adipriyono\n\n";
            balasan += "Terima kasih 😊";

            await msg.reply(balasan);
        } else {
            await msg.reply("Format pesanan salah. Contoh:\nPesan:\n- risol 3 pcs\n- donat 2 pcs");
        }
    }

    // Auto Reply berdasarkan jawaban.json
    else if (jawabanAutoReply[isiPesan]) {
        await msg.reply(jawabanAutoReply[isiPesan]);
    }

    // Keyword Matching (misalnya: rekening, norek)
    else {
        let ketemu = false;
        for (let keyword in jawabanKeyword) {
            if (isiPesan.includes(keyword)) {
                await msg.reply(jawabanKeyword[keyword]);
                ketemu = true;
                break;
            }
        }

        if (!ketemu) {
            await msg.reply('Maaf, saya belum bisa memahami pesan Anda.');
        }
    }
});

// Jalankan bot
client.initialize();