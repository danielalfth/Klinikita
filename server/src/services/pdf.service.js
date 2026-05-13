const PDFDocument = require('pdfkit');

function generatePrescriptionPDF(record) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const contentWidth = pageWidth - marginLeft - marginRight;

    const tglKunjungan = record.tanggal_kunjungan
      ? new Date(record.tanggal_kunjungan).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '-';
    
    // Format tanggal untuk signature (contoh: 12 Mei 2026)
    const tglSignature = record.created_at || record.tanggal_kunjungan
      ? new Date(record.created_at || record.tanggal_kunjungan).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const poliLabel = record.poli === 'umum' ? 'Poli Umum' : 'Poli Gigi';

    // Header
    doc.fillColor('#1a7a5e').fontSize(20).font('Helvetica-Bold').text('KLINIKITA', { align: 'center' });
    doc.fillColor('#333').fontSize(10).font('Helvetica').text('Jl. Prof. Soedarto, Tembalang, Jawa Tengah 50275', { align: 'center' });
    doc.text('Telp: (024) 76480609', { align: 'center' });
    doc.text(`${poliLabel}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(marginLeft, doc.y).lineTo(pageWidth - marginRight, doc.y).strokeColor('#1a7a5e').lineWidth(2).stroke();
    doc.moveDown(0.5);

    // Title
    doc.fillColor('#1a7a5e').fontSize(14).font('Helvetica-Bold').text('RESEP DOKTER', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor('#333').fontSize(10).font('Helvetica');
    doc.text(`Tanggal   : ${tglKunjungan}`);
    doc.text(`Dokter    : dr. ${record.nama_dokter}`);
    doc.moveDown(0.5);
    doc.moveTo(marginLeft, doc.y).lineTo(pageWidth - marginRight, doc.y).strokeColor('#ccc').lineWidth(1).stroke();
    doc.moveDown(0.5);

    // Patient data
    doc.fillColor('#1a7a5e').fontSize(11).font('Helvetica-Bold').text('DATA PASIEN');
    doc.fillColor('#333').fontSize(10).font('Helvetica');
    doc.text(`Nama         : ${record.nama_lengkap || '-'}`);
    doc.text(`Usia         : ${record.usia || '-'} tahun`);
    doc.text(`Jenis Kelamin: ${record.jenis_kelamin === 'laki_laki' ? 'Laki-laki' : 'Perempuan'}`);
    doc.moveDown(0.5);
    doc.moveTo(marginLeft, doc.y).lineTo(pageWidth - marginRight, doc.y).strokeColor('#ccc').lineWidth(1).stroke();
    doc.moveDown(0.5);

    // Diagnosis & Konsultasi
    doc.fillColor('#1a7a5e').fontSize(11).font('Helvetica-Bold').text('DIAGNOSIS');
    doc.fillColor('#333').fontSize(10).font('Helvetica').text(record.diagnosis || '-', {
      width: contentWidth,
      align: 'left'
    });
    doc.moveDown(0.5);
    doc.fillColor('#1a7a5e').fontSize(11).font('Helvetica-Bold').text('HASIL KONSULTASI');
    doc.fillColor('#333').fontSize(10).font('Helvetica').text(record.hasil_konsultasi || '-', {
      width: contentWidth,
      align: 'left'
    });
    doc.moveDown(0.5);
    doc.moveTo(marginLeft, doc.y).lineTo(pageWidth - marginRight, doc.y).strokeColor('#ccc').lineWidth(1).stroke();
    doc.moveDown(0.5);

    // Prescriptions
    doc.fillColor('#1a7a5e').fontSize(11).font('Helvetica-Bold').text('RESEP OBAT');
    doc.moveDown(0.3);
    if (record.prescriptions && record.prescriptions.length > 0) {
      record.prescriptions.forEach((p, i) => {
        doc.fillColor('#333').fontSize(10).font('Helvetica-Bold').text(`${i + 1}. ${p.nama_obat || '-'}`);
        doc.font('Helvetica').text(`   ${p.dosis_aturan || '-'}`, {
          width: contentWidth - 20,
          align: 'left'
        });
        doc.moveDown(0.3);
      });
    } else {
      doc.fillColor('#666').fontSize(10).font('Helvetica').text('(Tidak ada resep obat)');
    }

    doc.moveDown(1);
    doc.moveTo(marginLeft, doc.y).lineTo(pageWidth - marginRight, doc.y).strokeColor('#ccc').lineWidth(1).stroke();
    doc.moveDown(0.5);

    // Signature
    doc.fillColor('#333').fontSize(10).font('Helvetica').text(`Semarang, ${tglSignature}`, { align: 'right' });
    doc.moveDown(2.5);
    doc.text(`dr. ${record.nama_dokter || '-'}`, { align: 'right' });

    doc.end();
  });
}

module.exports = { generatePrescriptionPDF };
