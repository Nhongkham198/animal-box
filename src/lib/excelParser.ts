import * as XLSX from 'xlsx';

export interface ExcelPetData {
  name: string;
  species: string;
  breed: string;
  hn: string;
  birthDate: string;
  gender: 'Male' | 'Female';
  sterilized: boolean;
  microchip: string;
  drugAllergy: string;
  note: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
}

export const parsePetExcel = (FileData: ArrayBuffer): ExcelPetData[] => {
  const workbook = XLSX.read(FileData, { type: 'array' });
  const pets: ExcelPetData[] = [];

  // Iterate through ALL sheets in the workbook
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1000');

    // For each sheet, we look for data vertically stacked
    // A record usually spans about 30 rows based on the screenshot
    for (let col = range.s.c; col <= range.e.c; col++) {
      // Find all pet records in this column
      // We look for the "Pet ID" anchor to find where a record starts
      for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        // If we find a pet name (assuming it's not a label)
        // In the screenshot, the pet name is in row 1, 31, 61...
        // Let's use the layout: Row 0: Name, Row 4: Pet ID
        const potentialHnCell = worksheet[XLSX.utils.encode_cell({ r: row + 4, c: col })];
        const isPetRecord = potentialHnCell && String(potentialHnCell.v).trim().startsWith('P');

        if (isPetRecord) {
          const getVal = (offset: number) => {
            const c = worksheet[XLSX.utils.encode_cell({ r: row + offset - 1, c: col })];
            return c ? c.v : '';
          };

          const name = String(getVal(1)).trim();
          if (!name || name === 'undefined') continue;

          const speciesBreed = String(getVal(2));
          let species = 'Cat';
          let breed = '';
          if (speciesBreed.includes('|')) {
            const parts = speciesBreed.split('|');
            species = parts[0].includes('Cat') || parts[0].includes('แมว') ? 'Cat' : 'Dog';
            breed = parts[1].trim();
          } else {
            species = speciesBreed.includes('Cat') || speciesBreed.includes('แมว') ? 'Cat' : 'Dog';
          }

          const hn = String(getVal(5)).trim();
          
          const ageString = String(getVal(7));
          let birthDate = '';
          const dateMatch = ageString.match(/\((.*?)\)/);
          if (dateMatch && dateMatch[1]) {
            const datePart = dateMatch[1].trim();
            const ThaiMonths: Record<string, string> = {
              'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
              'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
              'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
            };
            
            const parts = datePart.split(' ');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = ThaiMonths[parts[1]] || '01';
              let year = parseInt(parts[2]);
              if (year > 2400) year -= 543;
              birthDate = `${year}-${month}-${day}`;
            }
          }

          const genderVal = String(getVal(9)).toLowerCase();
          const gender: 'Male' | 'Female' = (genderVal.includes('female') || genderVal.includes('เมีย')) ? 'Female' : 'Male';
          
          const sterilized = String(getVal(11)) !== '-';
          const microchip = String(getVal(17)) === '-' ? '' : String(getVal(17));
          const drugAllergy = String(getVal(21)) === '-' ? '' : String(getVal(21));
          const note = String(getVal(23)) === 'ยังไม่มีการบันทึก' ? '' : String(getVal(23));
          
          const ownerName = String(getVal(25)).trim();
          const rawPhone = String(getVal(27)).trim().replace(/[^0-9]/g, '');
          // Common Excel issue: leading zero is stripped. If it starts with non-zero and looks like a Thai phone number (9 digits mobile or 8 digits landline), prepend '0'.
          const ownerPhone = (rawPhone.length > 0 && !rawPhone.startsWith('0')) ? '0' + rawPhone : rawPhone;
          const ownerEmail = String(getVal(29)) === '-' ? '' : String(getVal(29)).trim();

          pets.push({
            name, species, breed, hn, birthDate, gender,
            sterilized, microchip, drugAllergy, note,
            ownerName, ownerPhone, ownerEmail
          });

          // Jump ahead by about 25 rows to not double count this record
          row += 25;
        }
      }
    }
  });

  return pets;
};
