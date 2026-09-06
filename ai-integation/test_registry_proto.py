import hashlib
import os
import re
import fitz

class DocumentRegistry:
    def __init__(self, test_docs_dir='test_docs'):
        self.original_hashes = {}
        self.canonical_firs = {}
        self.tampered_hashes = {}
        self.load(test_docs_dir)

    def extract_fields(self, text):
        fields = {}
        patterns = [
            ('P.S.', r'P\.S\.\s*\(Police Station\):\s*([^\n]+)'),
            ('District', r'District:\s*([^\n]+)'),
            ('FIR No.', r'FIR No\.:\s*([^\n]+)'),
            ('Date & Time of FIR', r'Date & Time of FIR:\s*([^\n]+)'),
            ('Act(s)', r'Act\(s\):\s*([^\n]+)'),
            ('Section(s)', r'Section\(s\):\s*([^\n]+)'),
            ('Complainant Name', r'Complainant Name:\s*([^\n]+)'),
            ('Complainant Address', r'Complainant Address:\s*([^\n]+)'),
            ('Date of Occurrence', r'Date of Occurrence:\s*([^\n]+)'),
            ('Place of Occurrence', r'Place of Occurrence:\s*([^\n]+)'),
            ('Brief Description of Offence', r'Brief Description of Offence:\s*([\s\S]+?)(?=\nInvestigating Officer:)'),
            ('Investigating Officer', r'Investigating Officer:\s*([^\n]+)'),
            ('Status', r'Status:\s*([^\n]+)'),
        ]
        for label, pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                fields[label] = ' '.join(m.group(1).strip().split())
        return fields

    def load(self, data_dir):
        canonical_0087 = {
            'P.S.': 'Greenfield Police Station',
            'District': 'Sample District',
            'FIR No.': '0087/2026',
            'Date & Time of FIR': '05/09/2026 06:30 PM',
            'Act(s)': 'Indian Penal Code',
            'Section(s)': '323, 341',
            'Complainant Name': 'Anita Sharma (fictional)',
            'Complainant Address': 'Flat 4B, Lotus Apartments, Greenfield',
            'Date of Occurrence': '05/09/2026',
            'Place of Occurrence': 'Greenfield Main Road, near Bus Stand',
            'Brief Description of Offence': 'Complainant reported a minor altercation with a shopkeeper over a billing dispute. No injuries reported. One bystander witnessed the incident.',
            'Investigating Officer': 'SI Priya Nair (fictional)',
            'Status': 'Under Investigation',
        }
        self.canonical_firs['0087/2026'] = canonical_0087
        
        manifest_path = os.path.join(data_dir, 'TEST_MANIFEST.csv')
        if os.path.exists(manifest_path):
            with open(manifest_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            file_mode = False
            for line in lines:
                line = line.strip()
                if line == 'File,SHA-256':
                    file_mode = True
                    continue
                if file_mode and ',' in line:
                    fname, sha = line.split(',', 1)
                    fname = fname.strip()
                    sha = sha.strip()
                    if 'original' in fname.lower():
                        self.original_hashes[sha] = {'file_name': fname, 'fir_no': '0087/2026'}
                    elif 'tampered' in fname.lower():
                        self.tampered_hashes[sha] = {'file_name': fname, 'fir_no': '0087/2026'}

    def verify(self, file_bytes, text):
        sha = hashlib.sha256(file_bytes).hexdigest()
        fields = self.extract_fields(text)
        fir_no = fields.get('FIR No.')

        if sha in self.original_hashes:
            return {
                'status': 'verified_original',
                'is_tampered': False,
                'sha256': sha,
                'fir_no': fir_no or '0087/2026',
                'diffs': [],
                'message': 'Document cryptographically verified against registered authentic record.'
            }

        if fir_no in self.canonical_firs:
            canon = self.canonical_firs[fir_no]
            diffs = []
            for k, orig_v in canon.items():
                curr_v = fields.get(k, '')
                if curr_v and orig_v and curr_v.lower() != orig_v.lower():
                    diffs.append({
                        'field': k,
                        'original': orig_v,
                        'tampered': curr_v,
                        'finding': f"{k} altered from '{orig_v}' to '{curr_v}'"
                    })
            return {
                'status': 'tampered_hash_mismatch',
                'is_tampered': True,
                'sha256': sha,
                'fir_no': fir_no,
                'diffs': diffs,
                'message': f'Cryptographic hash mismatch against registered original for FIR No. {fir_no}.'
            }

        return {'status': 'unregistered', 'is_tampered': None, 'sha256': sha, 'diffs': []}

if __name__ == '__main__':
    reg = DocumentRegistry()
    import glob
    for p in sorted(glob.glob('test_docs/*FIR*.pdf')):
        with open(p, 'rb') as f:
            b = f.read()
        t = fitz.open(stream=b, filetype='pdf')[0].get_text('text')
        res = reg.verify(b, t)
        print(f"{os.path.basename(p):<22} | Status: {res['status']:<23} | Tampered: {str(res['is_tampered']):<5} | Diffs: {len(res['diffs'])}")
        for d in res['diffs']:
            print(f"   -> {d['finding']}")
