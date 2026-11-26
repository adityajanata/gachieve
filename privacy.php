<?php

declare(strict_types=1);

require __DIR__ . '/includes/bootstrap.php';

// No $pageDescription: head.php would point the canonical link at the tracker.
$pageTitle = 'Kebijakan Privasi | ' . Config::get('app.name');
$trackerTools = false;
$contactEmail = 'admin@gachieve.com';

require __DIR__ . '/includes/views/head.php';

$email = htmlspecialchars($contactEmail, ENT_QUOTES, 'UTF-8');
?>
<body>
<div id="ui-app-root" class="ui-page">
    <?php require __DIR__ . '/includes/views/header.php'; ?>

    <main class="ui-content">
        <?php // Both languages are in the page; app.css shows the one that matches <html lang>, which the ID | EN toggle sets. ?>
        <article class="ui-doc ui-prose ui-lang-block" lang="id">
            <h1>Kebijakan Privasi</h1>
            <p class="ui-doc-meta">Terakhir diperbarui: 26 November 2026</p>
            <p>Gachieve adalah tracker achievement Genshin Impact buatan penggemar. Situs ini tidak berafiliasi dengan HoYoverse. Halaman ini menjelaskan data apa yang kami simpan, untuk apa, dan bagaimana Anda dapat mengatur atau menghapusnya.</p>

            <h2>Pengelola dan kontak</h2>
            <p>Situs ini dikelola oleh tim Gachieve. Untuk pertanyaan atau permintaan tentang data Anda, hubungi <a href="mailto:<?= $email ?>"><?= $email ?></a>.</p>

            <h2>Tanpa akun</h2>
            <p>Anda dapat memakai tracker tanpa masuk. Dalam hal ini tidak ada data progres yang dikirim ke server kami. Semua yang perlu diingat disimpan di browser Anda (localStorage):</p>
            <ul>
                <li>stage yang sudah Anda tandai selesai,</li>
                <li>aksi Bulk Mark terakhir, agar bisa dibatalkan,</li>
                <li>pilihan bahasa dan tema,</li>
                <li>apakah Anda sudah menutup banner informasi.</li>
            </ul>
            <p>Data ini hanya ada di perangkat dan browser tersebut. Data akan hilang jika Anda menghapus data situs di browser. Gunakan Export di Bulk Mark untuk menyimpan cadangannya.</p>

            <h2>Saat Anda masuk dengan Google</h2>
            <p>Login memakai Sign in with Google. Kami tidak pernah menerima kata sandi Google Anda. Dari Google kami menerima dan menyimpan:</p>
            <ul>
                <li>ID akun Google (pengenal unik, bukan kata sandi),</li>
                <li>alamat email,</li>
                <li>nama dan foto profil.</li>
            </ul>
            <p>Selain itu kami menyimpan:</p>
            <ul>
                <li>nama tampilan yang dapat Anda ubah,</li>
                <li>stage yang sudah selesai dan waktu penandaannya,</li>
                <li>aksi Bulk Mark terakhir, agar bisa dibatalkan,</li>
                <li>peran akun serta waktu daftar dan waktu masuk terakhir.</li>
            </ul>
            <p>Saat Anda masuk, progres yang tersimpan di browser otomatis digabung ke akun Anda, lalu dihapus dari browser.</p>
            <p>Untuk Contributor, kami juga menyimpan tutorial yang ditulis, gambar yang diunggah ke tutorial, riwayat review, poin, dan badge.</p>

            <h2>Untuk apa data dipakai</h2>
            <ul>
                <li>Menyimpan progres Anda dan menampilkannya di perangkat mana pun.</li>
                <li>Menampilkan nama tampilan, foto, dan badge sebagai kredit pada tutorial yang Anda tulis.</li>
                <li>Menjaga keamanan situs, misalnya membatasi jumlah permintaan agar tidak disalahgunakan.</li>
                <li>Mengelola akun dan peran oleh Administrator.</li>
            </ul>
            <p>Kami tidak menjual data Anda, tidak memakainya untuk iklan, dan tidak membuat profil pemasaran.</p>

            <h2>Siapa yang dapat melihat data Anda</h2>
            <ul>
                <li><strong>Semua pengunjung</strong> melihat nama tampilan, foto, dan badge pada tutorial yang Anda tulis. Progres Anda tidak ditampilkan ke publik.</li>
                <li><strong>Email Anda</strong> hanya terlihat oleh Anda sendiri dan oleh Administrator.</li>
                <li><strong>Administrator</strong> dapat melihat daftar pengguna (nama, email, peran, jumlah poin, waktu daftar dan masuk terakhir) untuk mengelola situs.</li>
            </ul>

            <h2>Cookie dan penyimpanan di browser</h2>
            <p>Kami memakai satu cookie sesi agar Anda tetap masuk dan agar formulir terlindung dari permintaan palsu. Cookie ini tidak dapat dibaca oleh JavaScript dan berlaku paling lama 30 hari. Kami tidak memakai cookie iklan atau cookie pelacak. Tombol Sign in with Google dapat memakai cookie milik Google sesuai kebijakan Google.</p>

            <h2>Layanan pihak ketiga</h2>
            <p>Beberapa bagian situs dimuat dari layanan lain. Seperti permintaan web pada umumnya, layanan tersebut menerima alamat IP dan informasi browser Anda:</p>
            <ul>
                <li><strong>Google</strong>: Sign in with Google dan Google Fonts (<a href="https://policies.google.com/privacy" rel="noopener">kebijakan privasi Google</a>).</li>
                <li><strong>Cloudflare Web Analytics</strong>: statistik kunjungan secara agregat, tanpa cookie (<a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">kebijakan privasi Cloudflare</a>).</li>
                <li><strong>YouTube</strong>: video tutorial memakai youtube-nocookie.com dan baru dimuat setelah Anda menekan tombol putar.</li>
                <li><strong>jsDelivr</strong>: CDN untuk ikon dan pustaka JavaScript (<a href="https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net" rel="noopener">kebijakan privasi jsDelivr</a>).</li>
            </ul>

            <h2>Data teknis dan keamanan</h2>
            <p>Kami tidak menyimpan alamat IP Anda secara langsung. Untuk membatasi jumlah permintaan, kami hanya menyimpan hash (sidik acak) dari alamat IP atau ID akun, dan penghitungnya dihapus secara berkala. Penyedia hosting dapat mencatat log akses standar sesuai kebijakannya. Koneksi memakai HTTPS dan akses ke data dibatasi menurut peran akun.</p>

            <h2>Berapa lama data disimpan</h2>
            <ul>
                <li>Data akun dan progres disimpan selama akun Anda ada.</li>
                <li>Saat akun dihapus, progres, poin, badge, dan riwayat Bulk Mark ikut terhapus. Tutorial yang Anda tulis tetap tampil dengan nama "Deleted Account", termasuk gambar di dalamnya.</li>
                <li>Catatan tindakan Administrator menyimpan nama Administrator yang bertindak dan tetap ada untuk keperluan audit.</li>
            </ul>

            <h2>Hak Anda</h2>
            <p>Sesuai Undang-Undang Pelindungan Data Pribadi (UU No. 27 Tahun 2022), Anda dapat:</p>
            <ul>
                <li>melihat dan memperbarui data Anda: nama tampilan dapat diubah di Profile,</li>
                <li>mengambil salinan progres Anda melalui Export di Bulk Mark,</li>
                <li>menghapus akun beserta datanya kapan saja melalui Delete Account di Profile,</li>
                <li>mengajukan permintaan lain ke <a href="mailto:<?= $email ?>"><?= $email ?></a>.</li>
            </ul>

            <h2>Perubahan kebijakan</h2>
            <p>Jika kebijakan ini berubah, kami memperbarui tanggal di bagian atas halaman ini. Perubahan penting juga akan diumumkan di situs.</p>
        </article>

        <article class="ui-doc ui-prose ui-lang-block" lang="en">
            <h1>Privacy Policy</h1>
            <p class="ui-doc-meta">Last updated: 26 November 2026</p>
            <p>Gachieve is a fan-made Genshin Impact achievement tracker. It is not affiliated with HoYoverse. This page explains what data we keep, why, and how you can manage or delete it.</p>

            <h2>Who runs this site</h2>
            <p>This site is run by the Gachieve team. For questions or requests about your data, contact <a href="mailto:<?= $email ?>"><?= $email ?></a>.</p>

            <h2>Without an account</h2>
            <p>You can use the tracker without signing in. In that case no progress data is sent to our server. Everything the site needs to remember is kept in your browser (localStorage):</p>
            <ul>
                <li>the stages you marked as done,</li>
                <li>your last Bulk Mark action, so it can be undone,</li>
                <li>your language and theme choice,</li>
                <li>whether you closed the information banner.</li>
            </ul>
            <p>This data stays on that device and browser only. It is lost when you clear the site data in your browser. Use Export in Bulk Mark to keep a backup.</p>

            <h2>When you sign in with Google</h2>
            <p>Sign-in uses Sign in with Google. We never receive your Google password. From Google we receive and keep:</p>
            <ul>
                <li>your Google account ID (a unique identifier, not a password),</li>
                <li>your email address,</li>
                <li>your name and profile picture.</li>
            </ul>
            <p>We also keep:</p>
            <ul>
                <li>a display name that you can change,</li>
                <li>the stages you completed and when you marked them,</li>
                <li>your last Bulk Mark action, so it can be undone,</li>
                <li>your account role, sign-up time and last sign-in time.</li>
            </ul>
            <p>When you sign in, progress saved in your browser is merged into your account automatically and then removed from the browser.</p>
            <p>For Contributors we also keep the tutorials they write, images uploaded to tutorials, review history, points and badges.</p>

            <h2>How we use data</h2>
            <ul>
                <li>To save your progress and show it on any device.</li>
                <li>To show your display name, picture and badge as credit on tutorials you write.</li>
                <li>To keep the site secure, for example by limiting how many requests can be made so it is not abused.</li>
                <li>So Administrators can manage accounts and roles.</li>
            </ul>
            <p>We do not sell your data, use it for advertising or build marketing profiles.</p>

            <h2>Who can see your data</h2>
            <ul>
                <li><strong>Every visitor</strong> sees the display name, picture and badge on tutorials you write. Your progress is never shown publicly.</li>
                <li><strong>Your email</strong> is visible only to you and to Administrators.</li>
                <li><strong>Administrators</strong> can see the user list (name, email, role, points, sign-up and last sign-in time) to run the site.</li>
            </ul>

            <h2>Cookies and browser storage</h2>
            <p>We use one session cookie to keep you signed in and to protect forms from forged requests. JavaScript cannot read it, and it lasts at most 30 days. We use no advertising or tracking cookies. The Sign in with Google button may use Google's own cookies under Google's policy.</p>

            <h2>Third-party services</h2>
            <p>Some parts of the site load from other services. As with any web request, these services receive your IP address and browser information:</p>
            <ul>
                <li><strong>Google</strong>: Sign in with Google and Google Fonts (<a href="https://policies.google.com/privacy" rel="noopener">Google privacy policy</a>).</li>
                <li><strong>Cloudflare Web Analytics</strong>: aggregate visit statistics, with no cookies (<a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare privacy policy</a>).</li>
                <li><strong>YouTube</strong>: tutorial videos use youtube-nocookie.com and load only after you press play.</li>
                <li><strong>jsDelivr</strong>: CDN for icons and JavaScript libraries (<a href="https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net" rel="noopener">jsDelivr privacy policy</a>).</li>
            </ul>

            <h2>Technical data and security</h2>
            <p>We do not store your IP address directly. To limit requests we keep only a hash (a one-way fingerprint) of the IP address or account ID, and those counters are deleted regularly. Our hosting provider may keep standard access logs under its own policy. Connections use HTTPS, and access to data is limited by account role.</p>

            <h2>How long we keep data</h2>
            <ul>
                <li>Account data and progress are kept for as long as your account exists.</li>
                <li>When an account is deleted, its progress, points, badges and Bulk Mark history are deleted too. Tutorials it wrote stay up under the name "Deleted Account", including their images.</li>
                <li>The record of Administrator actions keeps the name of the Administrator who acted and stays for audit purposes.</li>
            </ul>

            <h2>Your rights</h2>
            <p>Under Indonesia's Personal Data Protection Law (Law No. 27 of 2022), you can:</p>
            <ul>
                <li>see and update your data: your display name can be changed in Profile,</li>
                <li>get a copy of your progress with Export in Bulk Mark,</li>
                <li>delete your account and its data at any time with Delete Account in Profile,</li>
                <li>send any other request to <a href="mailto:<?= $email ?>"><?= $email ?></a>.</li>
            </ul>

            <h2>Changes to this policy</h2>
            <p>If this policy changes, we update the date at the top of this page. Important changes will also be announced on the site.</p>
        </article>
    </main>

    <?php require __DIR__ . '/includes/views/footer.php'; ?>
</div>
<script type="module" src="assets/js/tracker/privacy.js"></script>
</body>
</html>
