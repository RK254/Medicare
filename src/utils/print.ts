import { ClinicRecord, Patient } from "../types";

export function printMedicalReport(record: ClinicRecord, patient: Patient, doctorName?: string) {
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) {
    alert("Please allow popups to print medical reports.");
    return;
  }

  const attendingDoctor = record.staffMember || (doctorName ? doctorName : "Dr. Julius");

  const triageHtml = record.triage ? `
    <div class="section">
      <div class="section-title">Patient Triage & Vitals</div>
      <table class="vitals-table">
        <tr>
          <td><strong>Temperature:</strong> ${record.triage.temperature} °C</td>
          <td><strong>Blood Pressure:</strong> ${record.triage.systolicBP}/${record.triage.diastolicBP} mmHg</td>
        </tr>
        <tr>
          <td><strong>Pulse Rate:</strong> ${record.triage.pulseRate} bpm</td>
          <td><strong>Oxygen Saturation:</strong> ${record.triage.oxygenSaturation} %</td>
        </tr>
        <tr>
          <td><strong>Weight:</strong> ${record.triage.weight} kg</td>
          <td><strong>Height:</strong> ${record.triage.height} cm</td>
        </tr>
      </table>
    </div>
  ` : "";

  const prescriptionsHtml = record.prescription && record.prescription.medications.length > 0 ? `
    <div class="section">
      <div class="section-title">Prescribed Medication & Pharmacy Rx Order</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Medication Name</th>
            <th>Dosage Instructions</th>
            <th style="text-align: right;">Qty Requested</th>
          </tr>
        </thead>
        <tbody>
          ${record.prescription.medications.map(m => `
            <tr>
              <td><strong>${m.name}</strong></td>
              <td>${m.dosage}</td>
              <td style="text-align: right;">${m.qtyRequested}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `
    <div class="section">
      <div class="section-title">Prescribed Medication</div>
      <p style="font-style: italic; color: #666; font-size: 13px;">No pharmaceutical medications prescribed during this consultation.</p>
    </div>
  `;

  const extraServicesHtml = record.extraServices && record.extraServices.length > 0 ? `
    <div class="section">
      <div class="section-title">Administered Procedures & Clinical Services</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Service / Treatment</th>
            <th>Performing Provider</th>
            <th style="text-align: right;">Procedure Fee</th>
          </tr>
        </thead>
        <tbody>
          ${record.extraServices.map(s => `
            <tr>
              <td><strong>${s.name}</strong></td>
              <td>${record.staffMember || "Duty Clinician"}</td>
              <td style="text-align: right;">KES ${s.cost.toLocaleString()}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : "";

  const labHtml = record.labRequest && record.labRequest.results && record.labRequest.results.length > 0 ? `
    <div class="section">
      <div class="section-title">Laboratory Investigation Pathology Report</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Pathology Parameter</th>
            <th>Observed Value</th>
            <th>Reference Range</th>
          </tr>
        </thead>
        <tbody>
          ${record.labRequest.results.map(r => {
            const rangeParts = r.normalRange.split("-").map(Number);
            const valNum = Number(r.value);
            const isAbnormal = rangeParts.length === 2 && !isNaN(valNum) && (valNum < rangeParts[0] || valNum > rangeParts[1]);
            return `
              <tr>
                <td>${r.parameterName}</td>
                <td style="font-weight: bold; ${isAbnormal ? 'color: #b91c1c; background-color: #fef2f2;' : ''}">
                  ${r.value} ${r.unit} ${isAbnormal ? '⚠️' : ''}
                </td>
                <td style="color: #4b5563;">${r.normalRange} ${r.unit}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      ${record.labRequest.notes ? `
        <div class="notes-box" style="margin-top: 10px;">
          <strong>Pathologist/Lab Tech Remarks:</strong> ${record.labRequest.notes}
        </div>
      ` : ""}
    </div>
  ` : record.labStatus === "pending" ? `
    <div class="section">
      <div class="section-title">Laboratory Investigations</div>
      <p style="font-style: italic; color: #c2410c; font-size: 13px; background-color: #fff7ed; padding: 10px; border: 1px solid #ffedd5; border-radius: 6px;">
        ⏳ Lab tests are currently pending in laboratory queue.
      </p>
    </div>
  ` : "";

  const formattedDate = new Date(record.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Medical Report - ${patient.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 40px;
          font-size: 13px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .facility-info {
          text-align: left;
        }
        .facility-name {
          font-size: 24px;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: -0.5px;
        }
        .facility-sub {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: bold;
          letter-spacing: 1px;
          margin-top: 4px;
        }
        .report-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          padding: 8px 16px;
          background-color: #f8fafc;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .patient-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 25px;
        }
        .card-title {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin-bottom: 10px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .meta-item {
          margin-bottom: 6px;
        }
        .meta-label {
          font-weight: 600;
          color: #475569;
          display: inline-block;
          width: 120px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 13px;
          font-weight: bold;
          color: #1e3a8a;
          text-transform: uppercase;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 6px;
          margin-bottom: 12px;
          letter-spacing: 0.5px;
        }
        .notes-box {
          background-color: #f1f5f9;
          border-left: 3px solid #64748b;
          padding: 12px;
          font-style: italic;
          font-size: 13px;
          border-radius: 0 6px 6px 0;
        }
        .vitals-table {
          width: 100%;
          border-collapse: collapse;
        }
        .vitals-table td {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          background-color: #fafafa;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        .data-table th {
          background-color: #f1f5f9;
          font-weight: bold;
          color: #334155;
          text-align: left;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          font-size: 11px;
          text-transform: uppercase;
        }
        .data-table td {
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
        }
        .footer-signatures {
          margin-top: 60px;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 40px;
          page-break-inside: avoid;
        }
        .sig-box {
          border-top: 1px dashed #94a3b8;
          padding-top: 10px;
          text-align: center;
        }
        .stamp-box {
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .print-btn-bar {
          background-color: #0f172a;
          color: white;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 6px;
          margin-bottom: 25px;
        }
        .print-btn {
          background-color: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
        }
        .print-btn:hover {
          background-color: #1d4ed8;
        }
        @media print {
          .print-btn-bar {
            display: none;
          }
          body {
            margin: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <span>Official Patient Medical Record Print Portal</span>
        <button class="print-btn" onclick="window.print()">Click to Print Document</button>
      </div>

      <div class="header">
        <div class="facility-info">
          <div class="facility-name">JUL MEDICARE HOSPITAL</div>
          <div class="facility-sub">Care, Excellence, Integrity • Nairobi, KE</div>
        </div>
        <div class="report-title">Medical Consultation Report</div>
      </div>

      <div class="patient-card">
        <div class="card-title">Patient Demographics & Record Credentials</div>
        <div class="grid-2">
          <div>
            <div class="meta-item"><span class="meta-label">Patient Name:</span> <strong>${patient.name}</strong></div>
            <div class="meta-item"><span class="meta-label">Patient National ID:</span> <code style="font-weight: bold;">${patient.id}</code></div>
            <div class="meta-item"><span class="meta-label">Age / Gender:</span> ${patient.age} Years / ${patient.sex}</div>
          </div>
          <div>
            <div class="meta-item"><span class="meta-label">Consultation Date:</span> ${formattedDate}</div>
            <div class="meta-item"><span class="meta-label">Attending Doctor:</span> <strong>${attendingDoctor}</strong></div>
            <div class="meta-item"><span class="meta-label">Blood Group:</span> <strong style="color: #b91c1c;">${patient.bloodGroup || "Not Checked"}</strong></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Chief Complaint & Clinical Findings</div>
        <div class="notes-box">
          <strong>Presented Symptoms:</strong> ${record.symptoms || "Routine medical assessment"}
        </div>
        <div style="margin-top: 15px;">
          <strong>Clinical Diagnosis:</strong> <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${record.ailment || "General checkup"}</span>
        </div>
        ${record.notes ? `
          <div style="margin-top: 12px; background-color: #fafbfc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
            <strong>Doctor's Consultation Progress & Clinical Notes:</strong>
            <p style="margin-top: 6px; white-space: pre-wrap; font-size: 13px;">${record.notes}</p>
          </div>
        ` : ""}
      </div>

      ${triageHtml}

      ${labHtml}

      ${extraServicesHtml}

      ${prescriptionsHtml}

      <div class="footer-signatures">
        <div>
          <div style="height: 60px;"></div>
          <div class="sig-box">
            <strong>${attendingDoctor}</strong><br>
            <span style="font-size: 11px; color: #64748b;">Attending Physician Signature & License No.</span>
          </div>
        </div>
        <div>
          <div class="stamp-box">
            Jul Medicare Hospital<br>Official Stamp Section
          </div>
        </div>
      </div>

      <script>
        // Auto open print dialog on load
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

export function printDispensingReport(record: ClinicRecord, patient: Patient, pharmacistName: string) {
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) {
    alert("Please allow popups to print dispensing reports.");
    return;
  }

  // Calculate prescription details and history
  const meds = record.prescription?.medications || [];
  const status = record.prescriptionStatus === "fully_dispatched" ? "Completed" : "Pending";

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const prescribeDate = record.prescription?.prescribedAt 
    ? new Date(record.prescription.prescribedAt).toLocaleDateString()
    : new Date(record.date).toLocaleDateString();

  const dispenseHistoryHtml = record.prescription?.dispenseHistory && record.prescription.dispenseHistory.length > 0 ? `
    <div class="section">
      <div class="section-title">Incremental Dispensation Session History Logs</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Medication Name</th>
            <th style="text-align: right;">Quantity Issued</th>
            <th>Remaining Bal</th>
            <th>Dispensing Pharmacist</th>
          </tr>
        </thead>
        <tbody>
          ${record.prescription.dispenseHistory.map(h => `
            <tr>
              <td>${new Date(h.date).toLocaleDateString()} ${new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
              <td><strong>${h.medicationName}</strong></td>
              <td style="text-align: right; font-weight: bold;">${h.qtyDispensed}</td>
              <td style="color: #b45309; font-weight: 500;">${h.remainingBalance} outstanding</td>
              <td>${h.pharmacistName}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dispensation Slip - Rx #${record.id}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 40px;
          font-size: 13px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #7c3aed;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .facility-info {
          text-align: left;
        }
        .facility-name {
          font-size: 24px;
          font-weight: 800;
          color: #6d28d9;
          letter-spacing: -0.5px;
        }
        .facility-sub {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: bold;
          letter-spacing: 1px;
          margin-top: 4px;
        }
        .report-title {
          font-size: 18px;
          font-weight: 700;
          color: #7c3aed;
          border: 1px solid #ddd6fe;
          padding: 8px 16px;
          background-color: #f5f3ff;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .patient-card {
          background-color: #faf5ff;
          border: 1px solid #e9d5ff;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 25px;
        }
        .card-title {
          font-size: 12px;
          font-weight: 700;
          color: #6b21a8;
          text-transform: uppercase;
          border-bottom: 1px solid #f3e8ff;
          padding-bottom: 6px;
          margin-bottom: 10px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .meta-item {
          margin-bottom: 6px;
        }
        .meta-label {
          font-weight: 600;
          color: #4b5563;
          display: inline-block;
          width: 140px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 13px;
          font-weight: bold;
          color: #7c3aed;
          text-transform: uppercase;
          border-bottom: 1px solid #ddd6fe;
          padding-bottom: 6px;
          margin-bottom: 12px;
          letter-spacing: 0.5px;
        }
        .notes-box {
          background-color: #f5f3ff;
          border-left: 3px solid #7c3aed;
          padding: 12px;
          font-style: italic;
          font-size: 13px;
          border-radius: 0 6px 6px 0;
          margin-top: 10px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        .data-table th {
          background-color: #f5f3ff;
          font-weight: bold;
          color: #5b21b6;
          text-align: left;
          padding: 8px 12px;
          border: 1px solid #ddd6fe;
          font-size: 11px;
          text-transform: uppercase;
        }
        .data-table td {
          padding: 10px 12px;
          border: 1px solid #e9d5ff;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-weight: bold;
          font-size: 11px;
          text-transform: uppercase;
          border-radius: 4px;
        }
        .status-completed {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .status-pending {
          background-color: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .footer-signatures {
          margin-top: 60px;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 40px;
          page-break-inside: avoid;
        }
        .sig-box {
          border-top: 1px dashed #7c3aed;
          padding-top: 10px;
          text-align: center;
        }
        .stamp-box {
          border: 2px dashed #ddd6fe;
          border-radius: 8px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .print-btn-bar {
          background-color: #5b21b6;
          color: white;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 6px;
          margin-bottom: 25px;
        }
        .print-btn {
          background-color: #ffffff;
          color: #5b21b6;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
        }
        .print-btn:hover {
          background-color: #f3e8ff;
        }
        @media print {
          .print-btn-bar {
            display: none;
          }
          body {
            margin: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <span>Official Medication Dispensing Record Printout</span>
        <button class="print-btn" onclick="window.print()">Click to Print Receipt</button>
      </div>

      <div class="header">
        <div class="facility-info">
          <div class="facility-name">JUL MEDICARE PHARMACY</div>
          <div class="facility-sub">Care, Excellence, Integrity • Nairobi, KE</div>
        </div>
        <div class="report-title">Dispensing Record & prescription copy</div>
      </div>

      <div class="patient-card">
        <div class="card-title">Patient Details & Dispensing Context</div>
        <div class="grid-2">
          <div>
            <div class="meta-item"><span class="meta-label">Patient Name:</span> <strong>${patient.name}</strong></div>
            <div class="meta-item"><span class="meta-label">Patient National ID:</span> <code style="font-weight: bold;">${patient.id}</code></div>
            <div class="meta-item"><span class="meta-label">Age / Gender:</span> ${patient.age} Years / ${patient.sex}</div>
            <div class="meta-item"><span class="meta-label">Dispense Status:</span> 
              <span class="status-badge ${status === 'Completed' ? 'status-completed' : 'status-pending'}">
                ${status === 'Completed' ? '✓ Fully Issued' : '⚠️ Partially Issued'}
              </span>
            </div>
          </div>
          <div>
            <div class="meta-item"><span class="meta-label">Prescription Number:</span> <code style="font-weight: bold;">${record.id}</code></div>
            <div class="meta-item"><span class="meta-label">Prescribed On:</span> ${prescribeDate}</div>
            <div class="meta-item"><span class="meta-label">Prescribing Doctor:</span> <strong>${record.staffMember || "Dr. Julius"}</strong></div>
            <div class="meta-item"><span class="meta-label">Dispense Date/Time:</span> ${formattedDate}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Prescribed & Dispensed Medication List</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Medication Name & Strength</th>
              <th>Dosage Directions</th>
              <th style="text-align: right;">Prescribed</th>
              <th style="text-align: right;">Total Dispensed</th>
              <th style="text-align: right; color: #b91c1c;">Outstanding Bal</th>
            </tr>
          </thead>
          <tbody>
            ${meds.map(m => {
              const outstanding = m.qtyRequested - (m.qtyDispatched || 0);
              return `
                <tr>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.dosage}</td>
                  <td style="text-align: right;">${m.qtyRequested}</td>
                  <td style="text-align: right; font-weight: bold; color: #047857;">${m.qtyDispatched || 0}</td>
                  <td style="text-align: right; font-weight: bold; color: ${outstanding > 0 ? '#b91c1c' : '#475569'};">
                    ${outstanding > 0 ? outstanding : "0 (Nil)"}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        
        ${record.prescription?.pharmacistNotes ? `
          <div class="notes-box">
            <strong>Pharmacist Notes & Dosage Counselling Log:</strong>
            <p style="margin: 4px 0 0 0; white-space: pre-wrap; font-size: 12.5px;">${record.prescription.pharmacistNotes}</p>
          </div>
        ` : ""}
      </div>

      ${dispenseHistoryHtml}

      <div class="footer-signatures">
        <div>
          <div style="height: 60px;"></div>
          <div class="sig-box">
            <strong>${pharmacistName || "Duty Pharmacist"}</strong><br>
            <span style="font-size: 11px; color: #64748b;">Dispensing Pharmacist Signature</span>
          </div>
        </div>
        <div>
          <div class="stamp-box">
            Jul Medicare Pharmacy<br>Official Stamp Section
          </div>
        </div>
      </div>

      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

export function printFinanceReport(
  type: 'lab' | 'nursing' | 'combined',
  timePeriod: string,
  totalRevenue: number,
  totalCount: number,
  serviceBreakdown: Array<{ name: string; cost: number; count: number }>,
  staffBreakdown: Array<{ name: string; cost: number; count: number }>,
  startDateStr: string,
  endDateStr: string
) {
  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (!printWindow) {
    alert("Please allow popups to print financial reports.");
    return;
  }

  const reportTitle = type === 'lab' ? 'Laboratory Pathology Services' 
                    : type === 'nursing' ? 'Extra Nursing & Procedures' 
                    : 'Combined Clinical Revenue';

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Revenue Report - ${reportTitle}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 40px;
          font-size: 13px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .facility-name {
          font-size: 24px;
          font-weight: 800;
          color: #0369a1;
        }
        .facility-sub {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: bold;
          margin-top: 4px;
        }
        .report-label {
          font-size: 16px;
          font-weight: 700;
          color: #0284c7;
          border: 1px solid #bae6fd;
          padding: 8px 16px;
          background-color: #f0f9ff;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }
        .card-val {
          font-size: 24px;
          font-weight: 800;
          color: #0369a1;
          margin-top: 5px;
        }
        .card-lbl {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: bold;
        }
        .section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 13px;
          font-weight: bold;
          color: #0369a1;
          text-transform: uppercase;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 6px;
          margin-bottom: 12px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th {
          background-color: #f1f5f9;
          font-weight: bold;
          color: #334155;
          text-align: left;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          font-size: 11px;
          text-transform: uppercase;
        }
        .data-table td {
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
        }
        .text-right {
          text-align: right;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 25px;
          background-color: #fafafa;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .print-btn-bar {
          background-color: #0284c7;
          color: white;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 6px;
          margin-bottom: 25px;
        }
        .print-btn {
          background-color: #ffffff;
          color: #0284c7;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
        }
        .print-btn:hover {
          background-color: #e0f2fe;
        }
        @media print {
          .print-btn-bar {
            display: none;
          }
          body {
            margin: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <span>Finance Department • Management Revenue Report Portal</span>
        <button class="print-btn" onclick="window.print()">Print Official Report</button>
      </div>

      <div class="header">
        <div>
          <div class="facility-name">JUL MEDICARE HOSPITAL</div>
          <div class="facility-sub">Financial Management & ERP Module • Nairobi, KE</div>
        </div>
        <div class="report-label">Revenue Report</div>
      </div>

      <div class="meta-grid">
        <div>
          <strong>Report Scope:</strong> ${reportTitle}<br>
          <strong>Analysis Timeframe:</strong> <span style="text-transform: uppercase; font-weight: bold; color: #0284c7;">${timePeriod}</span>
        </div>
        <div>
          <strong>Analysis Period:</strong> ${startDateStr} to ${endDateStr}<br>
          <strong>Generated On:</strong> ${formattedDate}
        </div>
      </div>

      <div class="summary-cards">
        <div class="card">
          <div class="card-lbl">Total Procedures / Tests Performed</div>
          <div class="card-val">${totalCount}</div>
        </div>
        <div class="card">
          <div class="card-lbl">Gross Revenue Generated</div>
          <div class="card-val" style="color: #16a34a;">KES ${totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Revenue Grouped By Service / Procedure Type</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Service / Test Name</th>
              <th class="text-right">Units Performed</th>
              <th class="text-right">Total Revenue Generated (KES)</th>
              <th class="text-right">Revenue Contribution</th>
            </tr>
          </thead>
          <tbody>
            ${serviceBreakdown.length === 0 ? `
              <tr><td colspan="4" style="text-align: center; color: #64748b; font-style: italic;">No services logged in this period.</td></tr>
            ` : serviceBreakdown.map(s => {
              const contributionPercent = totalRevenue > 0 ? ((s.cost / totalRevenue) * 100).toFixed(1) : "0.0";
              return `
                <tr>
                  <td><strong>${s.name}</strong></td>
                  <td class="text-right font-medium">${s.count}</td>
                  <td class="text-right font-bold" style="color: #0f766e;">KES ${s.cost.toLocaleString()}</td>
                  <td class="text-right font-semibold text-slate-500">${contributionPercent}%</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Revenue Contribution Grouped By Staff Member</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Member / Clinician</th>
              <th class="text-right">Services Performed</th>
              <th class="text-right">Total Generated (KES)</th>
              <th class="text-right">Revenue Contribution</th>
            </tr>
          </thead>
          <tbody>
            ${staffBreakdown.length === 0 ? `
              <tr><td colspan="4" style="text-align: center; color: #64748b; font-style: italic;">No staff activity registered in this period.</td></tr>
            ` : staffBreakdown.map(s => {
              const contributionPercent = totalRevenue > 0 ? ((s.cost / totalRevenue) * 100).toFixed(1) : "0.0";
              return `
                <tr>
                  <td><strong>${s.name}</strong></td>
                  <td class="text-right font-medium">${s.count}</td>
                  <td class="text-right font-bold" style="color: #0369a1;">KES ${s.cost.toLocaleString()}</td>
                  <td class="text-right font-semibold text-slate-500">${contributionPercent}%</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 80px; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 11px; text-align: center; color: #64748b; page-break-inside: avoid;">
        This is an official clinical financial intelligence statement generated directly from the Jul Medicare ERP Operations database.<br>
        <strong>Jul Medicare Operations & Finance Department © 2026</strong>
      </div>

      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

