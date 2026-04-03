// pages/chat.js — Assistente Comercial Vivanexa SaaS v5
// ============================================================
// v5 ADICIONA ao v4:
// • Manifesto de assinatura no contrato (token + signatários)
// • Contagem regressiva configurável (hora + texto)
// • Salvar clientes com histórico de documentos
// • Módulos clicáveis (chips) — toggle em cfg.modChips
// • Limpar mensagens ao iniciar nova consulta
// • Header clicável (logo e nome levam para /chat)
// • Suporte a templates de proposta/contrato via configurações
// • Tabela vertical de produtos no contrato
// • Logo da empresa no contrato
// • Validação de duplicatas de clientes
// • Botão Relatórios no header
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

// ── Config padrão ─────────────────────────────────────────────
const DEFAULT_CFG = {
  company:'VIVANEXA', slogan:'Assistente Comercial de Preços',
  discMode:'screen', discAdPct:50, discMenPct:0, discClosePct:40,
  unlimitedStrategy:true, modChips:true,
  closingHour:18, closingText:'',
  plans:[
    {id:'basic',   name:'Basic',    maxCnpjs:25,  users:1},
    {id:'pro',     name:'Pro',      maxCnpjs:80,  users:1},
    {id:'top',     name:'Top',      maxCnpjs:150, users:5},
    {id:'topplus', name:'Top Plus', maxCnpjs:999, users:999},
  ],
  prices:{
    'Gestão Fiscal':{basic:[478,318],pro:[590,409],top:[1032,547],topplus:[1398,679]},
    'CND':          {basic:[0,48],  pro:[0,90],  top:[0,150],   topplus:[0,200]},
    'XML':          {basic:[478,199],pro:[590,299],top:[1032,349],topplus:[1398,399]},
    'BIA':          {basic:[478,129],pro:[590,169],top:[1032,280],topplus:[1398,299]},
    'IF':           {basic:[1600,379],pro:[1600,619],top:[1600,920]},
    'EP':           {basic:[0,39],  pro:[0,82],  top:[0,167]},
  },
  vouchers:[],
  clients:[],
  productNames:{'Gestão Fiscal':'Gestão Fiscal','CND':'CND','XML':'XML','BIA':'BIA','IF':'Inteligência Fiscal','EP':'e-PROCESSOS','Tributos':'Tributos'},
}
const IF_NO_CNPJ = ['IF','Tributos','EP']
const ALL_MODS   = ['Gestão Fiscal','BIA','CND','XML','IF','EP','Tributos']

// ── Utilitários ──────────────────────────────────────────────
const fmt   = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const clean  = s => s.replace(/\D/g,'')
const isCNPJ = s => s.length===14
const isCPF  = s => s.length===11

function fmtDoc(s){
  if(!s)return'—'
  if(s.length===14)return s.replace(/
^
(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})
$
/,'$1.$2.$3/$4-$5')
  if(s.length===11)return s.replace(/
^
(\d{3})(\d{3})(\d{3})(\d{2})
$
/,'$1.$2.$3-$4')
  return s
}
function getPlan(n,plans){const s=[...plans].sort((a,b)=>a.maxCnpjs-b.maxCnpjs);for(const p of s)if(n<=p.maxCnpjs)return p.id;return s[s.length-1].id}
function planLabel(id,plans){if(!id)return'—';const p=plans.find(p=>p.id===id);return p?p.name:id}
function prodName(key,productNames){if(!key)return key;return productNames[key]||key}
function getPriceForPlan(mod,planId,prices,plans){const pricesMod=prices[mod];if(!pricesMod)return[0,0];if(pricesMod[planId])return pricesMod[planId];const keyLower=planId.toLowerCase();for(let[k,v]of Object.entries(pricesMod))if(k.toLowerCase()===keyLower)return v;const keys=Object.keys(pricesMod);if(keys.length)return pricesMod[keys[keys.length-1]];return[0,0]}
function calcTributos(notas){if(!notas||notas<=0)return 0;if(notas<=50)return 169.90;if(notas<=100)return 200;return 200+(notas-100)*0.80}
function calcQuoteFullPrice(mods,planId,ifPlan,cnpjs,notas,config={}){const{prices={},plans=[],productNames={}}=config;const results=[];let tAd=0,tMen=0;for(let mod of mods){if(mod==='IF'){const p=ifPlan||'basic';const[aB,mB]=getPriceForPlan('IF',p,prices,plans);const ad=aB*2,men=mB*1.2;results.push({name:prodName('IF',productNames),ad,men,adD:ad,menD:men,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;continue}if(mod==='Tributos'){const m=calcTributos(notas);results.push({name:prodName('Tributos',productNames),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;continue}if(mod==='EP'){const epPlan=planId==='topplus'?'top':planId;const[,mB]=getPriceForPlan('EP',epPlan,prices,plans);const men=mB*1.2;results.push({name:prodName('EP',productNames),ad:0,men,adD:0,menD:men,isEP:true,plan:epPlan});tMen+=men;continue}const[aB,mB]=getPriceForPlan(mod,planId,prices,plans);let ad=aB>0?Math.max(aB*2,1000):0;let men=mB*1.2;if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200);results.push({name:prodName(mod,productNames),ad,men,adD:ad,menD:men,plan:planId});tAd+=ad;tMen+=men}return{results,tAd,tMen,tAdD:tAd,tMenD:tMen}}
function calcQuoteWithDiscount(mods,planId,ifPlan,cnpjs,notas,config={}){const{discAdPct=50,discMenPct=0,unlimitedStrategy=true,prices={},plans=[],productNames={}}=config;const results=[];let tAd=0,tMen=0,tAdD=0,tMenD=0;for(let mod of mods){if(mod==='IF'){const p=ifPlan||'basic';const[aB,mB]=getPriceForPlan('IF',p,prices,plans);const ad=aB*2,men=mB*1.2;const adD=aB,menD=mB;results.push({name:prodName('IF',productNames),ad,men,adD,menD,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD;continue}if(mod==='Tributos'){const m=calcTributos(notas);results.push({name:prodName('Tributos',productNames),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;tMenD+=m;continue}if(mod==='EP'){const epPlan=planId==='topplus'?'top':planId;const[,mB]=getPriceForPlan('EP',epPlan,prices,plans);const men=mB*1.2,menD=mB;results.push({name:prodName('EP',productNames),ad:0,men,adD:0,menD,isEP:true,plan:epPlan});tMen+=men;tMenD+=menD;continue}const[aB,mB]=getPriceForPlan(mod,planId,prices,plans);let ad=aB>0?Math.max(aB*2,1000):0;let men=mB*1.2;if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200);const adD=aB>0?aB:0;const menD=mB;results.push({name:prodName(mod,productNames),ad,men,adD,menD,plan:planId});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD}const discAd=discAdPct/100;const discMen=discMenPct/100;const tAdFinal=tAd*(1-discAd);const tMenFinal=tMen*(1-discMen);const tAdDFinal=tAdD*(1-discAd);const tMenDFinal=tMenD*(1-discMen);results.forEach(r=>{if(!r.isTributos&&!r.isEP){r.ad=r.ad*(1-discAd);r.adD=r.adD*(1-discAd)}if(!r.isTributos&&!r.isEP&&!r.isIF){r.men=r.men*(1-discMen);r.menD=r.menD*(1-discMen)}});return{results,tAd:tAdFinal,tMen:tMenFinal,tAdD:tAdDFinal,tMenD:tMenDFinal}}
function calcClosing(mods,planId,ifPlan,cnpjs,notas,config={}){const{discClosePct=40,unlimitedStrategy=true,prices={},plans=[],productNames={}}=config;const results=[];let tAd=0,tMen=0;const cp=discClosePct/100;for(let mod of mods){if(mod==='IF'){const p=ifPlan||'basic';const[aB,mB]=getPriceForPlan('IF',p,prices,plans);const ad=aB*(1-cp);results.push({name:prodName('IF',productNames),ad,men:mB,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=mB;continue}if(mod==='Tributos'){const m=calcTributos(notas);results.push({name:prodName('Tributos',productNames),ad:0,men:m,isTributos:true});tMen+=m;continue}if(mod==='EP'){const epPlan=planId==='topplus'?'top':planId;const[,mB]=getPriceForPlan('EP',epPlan,prices,plans);results.push({name:prodName('EP',productNames),ad:0,men:mB,isEP:true,plan:epPlan});tMen+=mB;continue}const[aB]=getPriceForPlan(mod,planId,prices,plans);const ad=aB>0?Math.max(aB*(1-cp),0):0;let men=0;if(mod==='BIA')men=0.85*(cnpjs||0);else if(mod==='CND')men=0.40*(cnpjs||0);else if(mod==='Gestão Fiscal')men=Math.max(2.00*(cnpjs||0),200);else if(mod==='XML')men=Math.max(1.75*(cnpjs||0),175);results.push({name:prodName(mod,productNames),ad,men,plan:planId});tAd+=ad;tMen+=men}return{results,tAd,tMen}}
function parseModules(text,productNames){const t=text.toLowerCase();const found=[];const ifName=(productNames['IF']||'Inteligência Fiscal').toLowerCase();const hasIF=/intelig[eê]ncia\s*fiscal|intelig.*fiscal/i.test(t)||(ifName&&t.includes(ifName));if(hasIF)found.push('IF');const tNoIF=t.replace(/intelig[eê]ncia\s*fiscal|intelig[\w\s]*fiscal/gi,'');const gfName=(productNames['Gestão Fiscal']||'').toLowerCase();if(/gest[aã]o\s*(e\s*an[aá]lise|fiscal)/i.test(tNoIF)||(/
\b
fiscal
\b
/i.test(tNoIF)&&!/intelig/i.test(tNoIF))||(gfName&&tNoIF.includes(gfName)))found.push('Gestão Fiscal');if(/
\b
bia
\b
/i.test(t))found.push('BIA');if(/
\b
cnd
\b
/i.test(t))found.push('CND');if(/
\b
xml
\b
/i.test(t))found.push('XML');if(/tributos/i.test(t))found.push('Tributos');const epName=(productNames['EP']||'').toLowerCase();if(/e[\s-]?process[o]s?|eprocess/i.test(t)||(epName&&t.includes(epName)))found.push('EP');return found}
function parseIFPlan(text,plans){const t=text.toLowerCase();for(let p of plans){if(t.includes(p.name.toLowerCase())||t.includes(p.id))return p.id}if(/
\b
top
\b
/i.test(t))return'top';if(/
\b
pro
\b
/i.test(t))return'pro';if(/
\b
basic
\b
/i.test(t))return'basic';return null}
function parseCNPJsQty(text){const m=text.match(/
\b
(\d+)\s*(cnpj[s]?)?
\b
/i);return m?parseInt(m[1]):null}
function parseUsers(text){const m=text.match(/
\b
(\d+)\s*(usu[aá]rio[s]?)?
\b
/i);return m?parseInt(m[1]):null}
function getNextDates(){const now=new Date(),day=now.getDate(),m=now.getMonth(),y=now.getFullYear();let tm,ty;if(day<=20){tm=m+1;ty=y;if(tm>11){tm=0;ty++}return[5,10,15,20,25].map(d=>`${String(d).padStart(2,'0')}/${String(tm+1).padStart(2,'0')}`)}else{tm=m+2;ty=y;if(tm>11){tm-=12;ty++}return[5,10,15].map(d=>`${String(d).padStart(2,'0')}/${String(tm+1).padStart(2,'0')}`)}}

// ── Componente ClienteForm ────────────────────────────────────
function ClientForm({ clientData, onSave, onCancel, cfg }) {
  const [formData, setFormData] = useState(clientData || {
    id: null,
    cnpj: '',
    nomeFantasia: '',
    razaoSocial: '',
    contatoNome: '',
    contatoEmail: '',
    contatoTelefone: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    implementationContact: { name: '', email: '', phone: '' },
    financialContact: { name: '', email: '', phone: '' },
    contatoCpf: '',
    regimeTributario: '',
  });
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  useEffect(() => {
    if (clientData) {
      setFormData(clientData);
    }
  }, [clientData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (parent, e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [name]: value
      }
    }));
  };

  const handleCepChange = async (e) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, cep: value }));
    const cleanedCep = value.replace(/\D/g, '');

    if (cleanedCep.length === 8) {
      setLoadingCep(true);
      setCepError('');
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepError('CEP não encontrado.');
        } else {
          setFormData(prev => ({
            ...prev,
            endereco: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf,
          }));
        }
      } catch (error) {
        setCepError('Erro ao buscar CEP.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleSave = () => {
    // Validação básica
    if (!formData.cnpj || !formData.nomeFantasia || !formData.contatoEmail) {
      alert('Por favor, preencha os campos obrigatórios (CNPJ, Nome Fantasia, E-mail do Contato).');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-xl text-gray-200">
      <h3 className="text-xl font-bold mb-4">{clientData ? '✏️ Editar Cliente' : '➕ Novo Cliente'}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium">CPF / CNPJ</label>
          <input type="text" name="cnpj" value={formData.cnpj} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Nome Fantasia / Nome</label>
          <input type="text" name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Razão Social</label>
          <input type="text" name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Nome do Contato Principal</label>
          <input type="text" name="contatoNome" value={formData.contatoNome} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail do Contato Principal</label>
          <input type="email" name="contatoEmail" value={formData.contatoEmail} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Telefone / WhatsApp</label>
          <input type="text" name="contatoTelefone" value={formData.contatoTelefone} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">CPF do Contato Principal</label>
          <input type="text" name="contatoCpf" value={formData.contatoCpf} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Regime Tributário</label>
          <select
            name="regimeTributario"
            value={formData.regimeTributario}
            onChange={handleChange}
            className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
          >
            <option value="">Selecione...</option>
            <option value="Simples Nacional">Simples Nacional</option>
            <option value="Lucro Presumido">Lucro Presumido</option>
            <option value="Lucro Real">Lucro Real</option>
            <option value="MEI">MEI</option>
          </select>
        </div>
      </div>

      <h4 className="font-semibold mt-6 mb-2">📍 Endereço</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">CEP</label>
          <input type="text" name="cep" value={formData.cep} onChange={handleCepChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
          {loadingCep && <p className="text-blue-400 text-xs mt-1">Buscando CEP...</p>}
          {cepError && <p className="text-red-500 text-xs mt-1">{cepError}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Endereço</label>
          <input type="text" name="endereco" value={formData.endereco} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Bairro</label>
          <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Cidade</label>
          <input type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Estado</label>
          <input type="text" name="estado" value={formData.estado} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
      </div>

      <h4 className="font-semibold mt-6 mb-2">👷 Responsável pela Implantação</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Nome</label>
          <input type="text" name="name" value={formData.implementationContact.name} onChange={(e) => handleNestedChange('implementationContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input type="email" name="email" value={formData.implementationContact.email} onChange={(e) => handleNestedChange('implementationContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Telefone</label>
          <input type="text" name="phone" value={formData.implementationContact.phone} onChange={(e) => handleNestedChange('implementationContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
      </div>

      <h4 className="font-semibold mt-6 mb-2">💰 Responsável Financeiro</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Nome</label>
          <input type="text" name="name" value={formData.financialContact.name} onChange={(e) => handleNestedChange('financialContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input type="email" name="email" value={formData.financialContact.email} onChange={(e) => handleNestedChange('financialContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Telefone</label>
          <input type="text" name="phone" value={formData.financialContact.phone} onChange={(e) => handleNestedChange('financialContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
      </div>

      <div className="flex justify-end space-x-4 mt-6">
        <button onClick={onCancel} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✅ Salvar Cliente</button>
      </div>
    </div>
  );
}

// ── Componente principal Chat ────────────────────────────────
export default function Chat() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [empresaId, setEmpresaId] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showAddPlanModal, setShowAddPlanModal] = useState(false)
  const [newPlanData, setNewPlanData] = useState({ id: '', name: '', maxCnpjs: 0, users: 1, unlimitedUsers: false })
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [showReportsModal, setShowReportsModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signData, setSignData] = useState(null)
  const [signError, setSignError] = useState('')
  const [signSuccess, setSignSuccess] = useState(false)
  const [signConsent, setSignConsent] = useState(false)
  const [consultorSignature, setConsultorSignature] = useState(null)
  const [clientSignature, setClientSignature] = useState(null)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [signatureFor, setSignatureFor] = useState(null) // 'consultor' or 'client'
  const [tempSignature, setTempSignature] = useState(null) // Temporarily holds drawn signature
  const [showEditDocModal, setShowEditDocModal] = useState(false)
  const [editingDocType, setEditingDocType] = useState(null) // 'proposta' or 'contrato'
  const [editingDocContent, setEditingDocContent] = useState('')
  const [showClientSearchModal, setShowClientSearchModal] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [filteredClients, setFilteredClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [showClientDetailsModal, setShowClientDetailsModal] = useState(false)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUserData, setNewUserData] = useState({ nome: '', email: '', telefone: '', perfil: 'padrao', password: '', signature: null, signatureImage: null })
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [newProductData, setNewProductData] = useState({ id: '', name: '', prices: {}, noAdesao: false, basicProTopOnly: false })
  const [showEditProductModal, setShowEditProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showVoucherModal, setShowVoucherModal] = useState(false)
  const [newVoucherData, setNewVoucherData] = useState({ prefix: '', discAdPct: 0, discMenPct: 0, expiresAt: '' })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentData, setPaymentData] = useState({
    adesaoCondition: 'vista',
    adesaoDueDate: '',
    mensalidadeDueDate: '',
    outraAdesaoDate: '',
    outraMensalidadeDate: '',
  })
  const [currentDoc, setCurrentDoc] = useState(null) // Para armazenar a proposta/contrato atual
  const [currentQuote, setCurrentQuote] = useState(null) // Para armazenar a cotação atual
  const [currentClient, setCurrentClient] = useState(null) // Para armazenar o cliente atual da cotação
  const [showQuoteModal, setShowQuoteModal] = useState(false) // Para exibir a cotação
  const [quoteType, setQuoteType] = useState('full') // 'full', 'discount', 'closing'
  const [quoteVoucher, setQuoteVoucher] = useState('') // Voucher aplicado na cotação
  const [quoteVoucherData, setQuoteVoucherData] = useState(null) // Dados do voucher
  const [quoteVoucherError, setQuoteVoucherError] = useState('') // Erro do voucher
  const [showContractModal, setShowContractModal] = useState(false) // Para exibir o contrato
  const [contractHtml, setContractHtml] = useState('') // HTML do contrato
  const [contractToken, setContractToken] = useState('') // Token de assinatura
  const [contractId, setContractId] = useState(null) // ID do contrato no histórico
  const [userProfile, setUserProfile] = useState(null) // Perfil do usuário logado

  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        router.push('/')
      } else {
        loadConfig(session.user.id)
      }
    })
    return () => authListener.subscription.unsubscribe()
  }, [])

  async function loadConfig(userId) {
    setLoading(true)
    const { data: perfil } = await supabase.from('perfis').select('*').eq('user_id', userId).maybeSingle()
    if (!perfil) {
      const nome = session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Usuário';
      const { data: novoPerfil } = await supabase.from('perfis').insert({
        user_id: userId, nome, email: session?.user?.email,
        empresa_id: userId, perfil: 'admin',
      }).select().single();
      setUserProfile(novoPerfil);
      setEmpresaId(userId);
    } else {
      setUserProfile(perfil);
      setEmpresaId(perfil.empresa_id);
    }

    const eid = perfil?.empresa_id || userId;
    setEmpresaId(eid);

    const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
    if (row?.value) {
      const loadedCfg = JSON.parse(row.value)
      setCfg(prev => ({ ...DEFAULT_CFG, ...loadedCfg }))
    } else {
      await supabase.from('vx_storage').insert({ key: `cfg:${eid}`, value: JSON.stringify(DEFAULT_CFG) })
      setCfg(DEFAULT_CFG)
    }
    setLoading(false)
  }

  async function saveConfig(newCfg) {
    const updatedCfg = { ...cfg, ...newCfg }
    setCfg(updatedCfg)
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(updatedCfg) }, { onConflict: 'key' })
  }

  async function handleSendMessage() {
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    // Limpar mensagens anteriores se for uma nova consulta
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content.includes('Olá!')) {
      setMessages([userMessage]);
    }

    // Processar a mensagem do usuário
    const lowerInput = input.toLowerCase()
    let assistantResponse = ''

    if (lowerInput.includes('olá') || lowerInput.includes('oi') || lowerInput.includes('bom dia') || lowerInput.includes('boa tarde')) {
      assistantResponse = 'Olá! Como posso ajudar hoje?'
    } else if (lowerInput.includes('configurações') || lowerInput.includes('configurar')) {
      setShowConfigModal(true)
      assistantResponse = 'Abrindo configurações...'
    } else if (lowerInput.includes('clientes') || lowerInput.includes('cliente')) {
      setShowClientSearchModal(true)
      assistantResponse = 'Abrindo busca de clientes...'
    } else if (lowerInput.includes('novo cliente') || lowerInput.includes('cadastrar cliente')) {
      setEditingClient(null)
      setShowClientModal(true)
      assistantResponse = 'Abrindo formulário para novo cliente...'
    } else if (lowerInput.includes('relatórios') || lowerInput.includes('relatorio')) {
      setShowReportsModal(true)
      assistantResponse = 'Abrindo relatórios...'
    } else if (lowerInput.includes('admin') || lowerInput.includes('painel master')) {
      setShowAdminPanel(true)
      assistantResponse = 'Abrindo painel master...'
    } else if (lowerInput.includes('limpar') || lowerInput.includes('nova consulta')) {
      setMessages([])
      setCurrentDoc(null)
      setCurrentQuote(null)
      setCurrentClient(null)
      assistantResponse = 'Iniciando nova consulta. Como posso ajudar?'
    } else if (lowerInput.includes('cotação') || lowerInput.includes('cotar') || lowerInput.includes('preço') || lowerInput.includes('quanto custa')) {
      // Lógica de cotação
      const cnpjs = parseCNPJsQty(lowerInput)
      const users = parseUsers(lowerInput)
      const mods = parseModules(lowerInput, cfg.productNames)
      const ifPlan = parseIFPlan(lowerInput, cfg.plans)
      const notas = lowerInput.includes('notas') ? parseInt(lowerInput.split('notas')[1].replace(/\D/g, '')) : 0

      if (mods.length === 0) {
        assistantResponse = 'Não consegui identificar os módulos. Por favor, especifique quais módulos você deseja cotar (ex: Gestão Fiscal, BIA, CND, XML, Inteligência Fiscal, e-PROCESSOS, Tributos).'
      } else if (!cnpjs && !mods.some(m => IF_NO_CNPJ.includes(m))) {
        assistantResponse = 'Por favor, informe a quantidade de CNPJs para a cotação.'
      } else {
        const planId = getPlan(cnpjs || 1, cfg.plans)
        const quote = calcQuoteWithDiscount(mods, planId, ifPlan, cnpjs, notas, cfg)
        setCurrentQuote(quote)
        setCurrentDoc({
          type: 'proposta',
          data: {
            modules: mods,
            planId,
            ifPlan,
            cnpjs,
            notas,
            quote,
            client: currentClient,
            consultor: userProfile?.nome || session?.user?.email,
            consultorEmail: userProfile?.email || session?.user?.email,
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
            userId: userProfile?.id,
          }
        })
        setShowQuoteModal(true)
        assistantResponse = 'Gerando cotação...'
      }
    } else if (lowerInput.includes('gerar contrato') || lowerInput.includes('contrato')) {
      if (!currentQuote || !currentDoc) {
        assistantResponse = 'Por favor, gere uma cotação primeiro.'
      } else if (!currentClient) {
        assistantResponse = 'Por favor, selecione ou cadastre um cliente antes de gerar o contrato.'
      } else {
        setShowPaymentModal(true)
        assistantResponse = 'Configurando condições de pagamento para o contrato...'
      }
    } else {
      assistantResponse = 'Desculpe, não entendi. Posso ajudar com cotações, configurações, clientes ou relatórios.'
    }

    setMessages(prev => [...prev, { role: 'assistant', content: assistantResponse }])
  }

  async function handleSaveClient(client) {
    let updatedClients = [...cfg.clients];
    if (client.id) {
      // Editar cliente existente
      const index = updatedClients.findIndex(c => c.id === client.id);
      if (index !== -1) {
        updatedClients[index] = client;
      }
    } else {
      // Adicionar novo cliente
      // Gerar um ID único para o cliente
      client.id = Date.now().toString();
      // Validar CNPJ/CPF duplicado
      const isDuplicate = updatedClients.some(c => clean(c.cnpj) === clean(client.cnpj) && c.id !== client.id);
      if (isDuplicate) {
        alert('Já existe um cliente com este CNPJ/CPF.');
        return;
      }
      updatedClients.push(client);
    }
    await saveConfig({ clients: updatedClients });
    setShowClientModal(false);
    setEditingClient(null);
    setSelectedClient(client); // Seleciona o cliente salvo/editado
    setCurrentClient(client); // Define como cliente atual para cotação/contrato
    setMessages(prev => [...prev, { role: 'assistant', content: `Cliente "${client.nomeFantasia}" salvo e selecionado.` }]);
  }

  async function handleSelectClient(client) {
    setSelectedClient(client);
    setCurrentClient(client);
    setShowClientSearchModal(false);
    setMessages(prev => [...prev, { role: 'assistant', content: `Cliente "${client.nomeFantasia}" selecionado.` }]);
  }

  async function handleGenerateContract() {
    if (!currentDoc || !currentClient || !currentQuote) {
      alert('Por favor, gere uma cotação e selecione um cliente primeiro.');
      return;
    }

    const contractData = {
      ...currentDoc.data,
      client: currentClient,
      payment: paymentData,
      type: 'contrato',
      date: new Date().toISOString().split('T')[0],
      dateISO: new Date().toISOString(),
      criado: new Date().toISOString(),
      status: 'pending', // Aguardando assinatura
      token: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), // Token único para assinatura
    };

    const html = buildContract(contractData, cfg, userProfile);
    setContractHtml(html);
    setContractToken(contractData.token);

    // Salvar no histórico de documentos
    const updatedDocHistory = [...(cfg.docHistory || []), contractData];
    await saveConfig({ docHistory: updatedDocHistory });

    // Atualizar o currentDoc com o ID gerado e o token
    setCurrentDoc(prev => ({ ...prev, data: contractData }));
    setContractId(contractData.id); // Armazena o ID do contrato salvo

    setShowPaymentModal(false);
    setShowContractModal(true);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Contrato gerado. Por favor, revise e envie para assinatura.' }]);
  }

  async function handleSendContractForSignature() {
    if (!contractHtml || !currentDoc || !currentClient || !userProfile) {
      alert('Erro: Contrato ou dados do cliente/consultor ausentes.');
      return;
    }

    const contract = currentDoc.data;
    const signLink = `${window.location.origin}/sign/${contract.token}`;

    // 1. Gerar PDF do contrato
    let pdfBufferBase64 = null;
    try {
      const pdfRes = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: contractHtml }),
      });

      if (!pdfRes.ok) {
        const errorText = await pdfRes.text();
        throw new Error(`Falha ao gerar PDF: ${errorText}`);
      }

      const pdfBlob = await pdfRes.blob();
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      await new Promise(resolve => {
        reader.onloadend = () => {
          pdfBufferBase64 = reader.result.split(',')[1]; // Pega apenas o base64
          resolve();
        };
      });

    } catch (error) {
      console.error('Erro ao gerar PDF para envio:', error);
      alert(`Erro ao gerar PDF do contrato: ${error.message}. O e-mail será enviado sem o anexo PDF.`);
    }

    // 2. Enviar e-mail
    const emailSubject = `Contrato Vivanexa - ${currentClient.nomeFantasia}`;
    const emailBody = `
      Olá ${currentClient.contatoNome},<br><br>
      Seu contrato com a Vivanexa está pronto para ser assinado.<br>
      Por favor, clique no link abaixo para revisar e assinar eletronicamente:<br><br>
      <a href="${signLink}">${signLink}</a><br><br>
      Atenciosamente,<br>
      ${userProfile.nome || 'Equipe Vivanexa'}
    `;

    const attachments = pdfBufferBase64 ? [{
      filename: `contrato_${currentClient.cnpj || 'vivanexa'}.pdf`,
      content: pdfBufferBase64,
      encoding: 'base64',
      contentType: 'application/pdf'
    }] : [];

    try {
      const emailRes = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: currentClient.contatoEmail,
          subject: emailSubject,
          html: emailBody,
          from: cfg.emailRemetente || 'noreply@vivanexa.com',
          config: cfg.emailConfig, // Se tiver configurações SMTP salvas
          attachments: attachments,
        }),
      });

      if (!emailRes.ok) {
        const errorData = await emailRes.json();
        throw new Error(errorData.error || 'Erro ao enviar e-mail.');
      }

      alert('Contrato enviado para o cliente por e-mail com sucesso!');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Contrato enviado para o cliente por e-mail.' }]);

      // Atualizar status do contrato no histórico para 'sent'
      const updatedDocHistory = cfg.docHistory.map(doc =>
        doc.token === contract.token ? { ...doc, status: 'sent' } : doc
      );
      await saveConfig({ docHistory: updatedDocHistory });

    } catch (error) {
      console.error('Erro ao enviar e-mail do contrato:', error);
      alert(`Falha ao enviar e-mail do contrato: ${error.message}`);
    }
  }

  async function handleSignContract() {
    if (!signData || !signConsent || !consultorSignature || !clientSignature) {
      setSignError('Por favor, preencha todos os campos, concorde com os termos e garanta que ambas as partes assinaram.');
      return;
    }

    setSignError('');
    setSignSuccess(false);

    try {
      // Atualizar o contrato no histórico com as assinaturas e status 'signed'
      const updatedDocHistory = cfg.docHistory.map(doc => {
        if (doc.token === signData.token) {
          return {
            ...doc,
            status: 'signed',
            consultorSignature: consultorSignature,
            clientSignature: clientSignature,
            clientSignInfo: {
              nome: signData.nome,
              cpf: signData.cpf,
              email: signData.email,
              ip: signData.ip,
              date: new Date().toISOString(),
            },
            signedAt: new Date().toISOString(),
          };
        }
        return doc;
      });

      await saveConfig({ docHistory: updatedDocHistory });
      setSignSuccess(true);
      alert('Contrato assinado com sucesso!');

      // Gerar o PDF final com as assinaturas e enviar por e-mail
      const signedContract = updatedDocHistory.find(doc => doc.token === signData.token);
      if (signedContract) {
        const finalHtml = buildContract(signedContract, cfg, userProfile); // Reconstruir HTML com assinaturas
        const clientEmail = signedContract.client.contatoEmail;
        const consultorEmail = signedContract.consultorEmail;

        // 1. Gerar PDF do contrato assinado
        let pdfBufferBase64 = null;
        try {
          const pdfRes = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ htmlContent: finalHtml }),
          });

          if (!pdfRes.ok) {
            const errorText = await pdfRes.text();
            throw new Error(`Falha ao gerar PDF final: ${errorText}`);
          }

          const pdfBlob = await pdfRes.blob();
          const reader = new FileReader();
          reader.readAsDataURL(pdfBlob);
          await new Promise(resolve => {
            reader.onloadend = () => {
              pdfBufferBase64 = reader.result.split(',')[1]; // Pega apenas o base64
              resolve();
            };
          });

        } catch (error) {
          console.error('Erro ao gerar PDF final para envio:', error);
          alert(`Erro ao gerar PDF do contrato assinado: ${error.message}. O e-mail será enviado sem o anexo PDF.`);
        }

        // 2. Enviar e-mail para cliente e consultor com o PDF assinado
        const emailSubject = `Contrato Vivanexa - ${signedContract.client.nomeFantasia} - ASSINADO`;
        const emailBody = `
          Olá,<br><br>
          O contrato com a Vivanexa para ${signedContract.client.nomeFantasia} foi assinado por ambas as partes.<br>
          Uma cópia do contrato assinado está anexada a este e-mail.<br><br>
          Atenciosamente,<br>
          Equipe Vivanexa
        `;

        const attachments = pdfBufferBase64 ? [{
          filename: `contrato_assinado_${signedContract.client.cnpj || 'vivanexa'}.pdf`,
          content: pdfBufferBase64,
          encoding: 'base64',
          contentType: 'application/pdf'
        }] : [];

        try {
          // Enviar para o cliente
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: clientEmail,
              subject: emailSubject,
              html: emailBody,
              from: cfg.emailRemetente || 'noreply@vivanexa.com',
              config: cfg.emailConfig,
              attachments: attachments,
            }),
          });

          // Enviar para o consultor
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: consultorEmail,
              subject: emailSubject,
              html: emailBody,
              from: cfg.emailRemetente || 'noreply@vivanexa.com',
              config: cfg.emailConfig,
              attachments: attachments,
            }),
          });

          alert('Cópia do contrato assinado enviada por e-mail para o cliente e consultor!');
        } catch (emailError) {
          console.error('Erro ao enviar e-mail do contrato assinado:', emailError);
          alert(`Falha ao enviar cópia do contrato assinado por e-mail: ${emailError.message}`);
        }
      }

      setShowSignModal(false);
      setSignData(null);
      setConsultorSignature(null);
      setClientSignature(null);
      setSignConsent(false);
      router.push('/chat'); // Redireciona de volta para o chat
    } catch (error) {
      console.error('Erro ao assinar contrato:', error);
      setSignError(`Falha ao assinar contrato: ${error.message}`);
    }
  }

  // Função para construir o HTML do contrato
  function buildContract(doc, cfg, userProfile) {
    const client = doc.client || {};
    const quote = doc.quote || {};
    const payment = doc.payment || {};
    const consultor = doc.consultor || userProfile?.nome || 'Consultor Vivanexa';
    const consultorEmail = doc.consultorEmail || userProfile?.email || 'consultor@vivanexa.com';
    const companyName = cfg.company || 'VIVANEXA';
    const companyLogo = cfg.logob64 ? `<img src="${cfg.logob64}" alt="${companyName}" style="max-height: 60px; margin-bottom: 20px;">` : `<h1 style="color: #00d4ff; margin-bottom: 20px;">${companyName}</h1>`;
    const contractTemplate = cfg.contractTemplate || `
      <p>Este é um contrato de prestação de serviços entre as partes:</p>
      <p><strong>CONTRATADA:</strong> ${companyName}, com sede em [Endereço da Vivanexa], CNPJ [CNPJ da Vivanexa].</p>
      <p><strong>CONTRATANTE:</strong> ${client.razaoSocial || client.nomeFantasia}, com sede em ${client.endereco}, ${client.bairro}, ${client.cidade} - ${client.estado}, CEP ${fmtDoc(client.cep)}, CNPJ ${fmtDoc(client.cnpj)}.</p>
      <p>O presente contrato tem como objeto a prestação dos serviços e módulos de software conforme detalhado abaixo:</p>
      <!-- PRODUTOS_TABLE -->
      <p><strong>Condições de Pagamento:</strong></p>
      <ul>
        <li><strong>Adesão:</strong> ${payment.adesaoCondition === 'vista' ? 'Pagamento à vista' : payment.adesaoCondition === 'cartao' ? 'Cartão de Crédito - sem juros' : 'Boleto parcelado - sem juros'}</li>
        <li><strong>Vencimento da Adesão:</strong> ${payment.adesaoDueDate === 'outra' ? payment.outraAdesaoDate : payment.adesaoDueDate}</li>
        <li><strong>Vencimento da Mensalidade:</strong> ${payment.mensalidadeDueDate === 'outra' ? payment.outraMensalidadeDate : payment.mensalidadeDueDate}</li>
      </ul>
      <p>O valor total da adesão é de <strong>${fmt(quote.tAd)}</strong> e a mensalidade recorrente é de <strong>${fmt(quote.tMen)}</strong>.</p>
      <p>Este contrato é regido pelas leis brasileiras e as partes elegem o foro da comarca de [Cidade da Vivanexa] para dirimir quaisquer dúvidas.</p>
      <p>E, por estarem assim justos e contratados, as partes assinam o presente instrumento em duas vias de igual teor e forma.</p>
      <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
      <!-- ASSINATURAS -->
    `;

    let productsTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Módulo</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Adesão</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Mensalidade</th>
          </tr>
        </thead>
        <tbody>
    `;
    quote.results.forEach(item => {
      productsTableHtml += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${fmt(item.ad)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${fmt(item.men)}</td>
        </tr>
      `;
    });
    productsTableHtml += `
        <tr style="font-weight: bold;">
          <td style="padding: 8px; border: 1px solid #ddd;">Total</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${fmt(quote.tAd)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${fmt(quote.tMen)}</td>
        </tr>
        </tbody>
      </table>
    `;

    let signaturesHtml = `
      <div style="margin-top: 50px; display: flex; justify-content: space-around; flex-wrap: wrap;">
        <div style="text-align: center; margin: 20px;">
          <p>___________________________________</p>
          <p><strong>${consultor}</strong></p>
          <p>Consultor Vivanexa</p>
          <p>${consultorEmail}</p>
          ${doc.consultorSignature ? `<img src="${doc.consultorSignature}" alt="Assinatura do Consultor" style="max-width: 200px; max-height: 100px; margin-top: 10px;">` : ''}
        </div>
        <div style="text-align: center; margin: 20px;">
          <p>___________________________________</p>
          <p><strong>${client.contatoNome || client.nomeFantasia}</strong></p>
          <p>${client.razaoSocial || client.nomeFantasia}</p>
          <p>${client.contatoCpf ? `CPF: ${fmtDoc(client.contatoCpf)}` : `CNPJ: ${fmtDoc(client.cnpj)}`}</p>
          <p>${client.contatoEmail}</p>
          ${doc.clientSignature ? `<img src="${doc.clientSignature}" alt="Assinatura do Cliente" style="max-width: 200px; max-height: 100px; margin-top: 10px;">` : ''}
        </div>
      </div>
    `;

    if (doc.status === 'signed' && doc.clientSignInfo) {
      signaturesHtml += `
        <div style="margin-top: 30px; font-size: 10px; color: #666;">
          <p><strong>Manifesto de Assinatura Eletrônica:</strong></p>
          <p>Este documento foi assinado eletronicamente por:</p>
          <ul>
            <li><strong>Consultor:</strong> ${doc.consultor || userProfile?.nome} (${doc.consultorEmail || userProfile?.email})</li>
            <li><strong>Cliente:</strong> ${doc.clientSignInfo.nome} (CPF: ${fmtDoc(doc.clientSignInfo.cpf)}, E-mail: ${doc.clientSignInfo.email})</li>
          </ul>
          <p>Data e Hora da Assinatura do Cliente: ${new Date(doc.clientSignInfo.date).toLocaleString('pt-BR')}</p>
          <p>Endereço IP do Cliente: ${doc.clientSignInfo.ip}</p>
          <p>Token de Verificação: ${doc.token}</p>
          <p>Assinatura válida conforme Lei nº 14.063/2020.</p>
        </div>
      `;
    }

    let finalHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contrato de Prestação de Serviços - ${companyName}</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
              .container { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
              h1, h2, h3 { color: #0056b3; }
              strong { font-weight: bold; }
              ul { list-style-type: disc; margin-left: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .signature-block { margin-top: 50px; text-align: center; }
              .signature-line { border-top: 1px solid #000; width: 60%; margin: 20px auto 5px auto; }
              .footer { margin-top: 50px; font-size: 0.8em; text-align: center; color: #777; }
          </style>
      </head>
      <body>
          <div class="container">
              <div style="text-align: center; margin-bottom: 30px;">
                  ${companyLogo}
                  <h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2>
              </div>
              ${contractTemplate
                  .replace('<!-- PRODUTOS_TABLE -->', productsTableHtml)
                  .replace('<!-- ASSINATURAS -->', signaturesHtml)
              }
          </div>
      </body>
      </html>
    `;
    return finalHtml;
  }

  // Componente para desenhar assinatura
  function SignaturePad({ onSave, onCancel }) {
    const canvasRef = useRef(null);
    const [drawing, setDrawing] = useState(false);
    const [ctx, setCtx] = useState(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      setCtx(context);
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.strokeStyle = '#fff'; // Cor da caneta
    }, []);

    const startDrawing = ({ nativeEvent }) => {
      const { offsetX, offsetY } = nativeEvent;
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
      setDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
      if (!drawing) return;
      const { offsetX, offsetY } = nativeEvent;
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    };

    const endDrawing = () => {
      setDrawing(false);
      ctx.closePath();
    };

    const clearCanvas = () => {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const saveSignature = () => {
      const dataURL = canvasRef.current.toDataURL('image/png');
      onSave(dataURL);
    };

    return (
      <div className="flex flex-col items-center p-4 bg-gray-800 rounded-lg shadow-xl">
        <h3 className="text-xl font-bold mb-4">✍️ Desenhar Assinatura</h3>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="border border-gray-600 bg-gray-900 rounded-md cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
        />
        <div className="flex space-x-4 mt-4">
          <button onClick={saveSignature} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✅ Usar esta assinatura</button>
          <button onClick={clearCanvas} className="px-6 py-2 bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors">🗑 Limpar</button>
          <button onClick={onCancel} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <Head>
        <title>{cfg.company} – {cfg.slogan}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Orbs de fundo */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob z-0"></div>
      <div className="fixed top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000 z-0"></div>
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000 z-0"></div>

      {/* Header */}
      <header className="relative z-10 w-full bg-gray-800 p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push('/chat')}>
          {cfg.logob64 ? (
            <img src={cfg.logob64} alt={cfg.company} className="h-9" />
          ) : (
            <h1 className="text-2xl font-bold text-blue-400">{cfg.company}</h1>
          )}
          <span className="text-gray-400 text-sm hidden md:block">{cfg.slogan}</span>
        </div>
        <div className="flex items-center space-x-4">
          {userProfile && (
            <span className="text-sm text-gray-300 hidden sm:block">Olá, {userProfile.nome}!</span>
          )}
          <button onClick={() => router.push('/reports')} className="px-3 py-1 bg-gray-700 rounded-md text-sm hover:bg-gray-600 transition-colors">📊 Relatórios</button>
          <button onClick={() => setShowConfigModal(true)} className="px-3 py-1 bg-gray-700 rounded-md text-sm hover:bg-gray-600 transition-colors">⚙️ Config</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="px-3 py-1 bg-red-600 rounded-md text-sm hover:bg-red-700 transition-colors">Sair</button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col items-center p-4 relative z-10">
        <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col space-y-4 flex-1">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-10">
                <p className="text-lg">Olá! Sou seu assistente comercial da Vivanexa.</p>
                <p className="text-sm mt-2">Como posso ajudar hoje? Posso gerar cotações, contratos, gerenciar clientes ou acessar configurações.</p>
                {cfg.modChips && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {ALL_MODS.map(mod => (
                      <button
                        key={mod}
                        onClick={() => setInput(prev => `${prev} ${mod}`.trim())}
                        className="px-3 py-1 bg-gray-700 rounded-full text-xs hover:bg-gray-600 transition-colors"
                      >
                        {prodName(mod, cfg.productNames)}
                      </button>
                    ))}
                    <button
                      onClick={() => setInput('cotar Gestão Fiscal 50 CNPJs')}
                      className="px-3 py-1 bg-gray-700 rounded-full text-xs hover:bg-gray-600 transition-colors"
                    >
                      Cotar GF 50 CNPJs
                    </button>
                    <button
                      onClick={() => setInput('gerar contrato')}
                      className="px-3 py-1 bg-gray-700 rounded-full text-xs hover:bg-gray-600 transition-colors"
                    >
                      Gerar Contrato
                    </button>
                    <button
                      onClick={() => setInput('clientes')}
                      className="px-3 py-1 bg-gray-700 rounded-full text-xs hover:bg-gray-600 transition-colors"
                    >
                      Gerenciar Clientes
                    </button>
                  </div>
                )}
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-[70%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex items-center space-x-2 mt-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Digite sua mensagem..."
              className="flex-1 p-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              className="p-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Enviar
            </button>
          </div>
        </div>
      </main>

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">⚙️ Configurações</h3>
            <button onClick={() => setShowConfigModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            {/* Configurações da Empresa */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">🏢 Empresa</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Nome da Empresa</label>
                  <input
                    type="text"
                    value={cfg.company}
                    onChange={(e) => saveConfig({ company: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Slogan / Subtítulo</label>
                  <input
                    type="text"
                    value={cfg.slogan}
                    onChange={(e) => saveConfig({ slogan: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Logomarca (Base64)</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          saveConfig({ logob64: reader.result });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="mt-1 block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {cfg.logob64 && <img src={cfg.logob64} alt="Logo" className="mt-2 h-16" />}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Chave API Google Gemini</label>
                  <input
                    type="text"
                    value={cfg.geminiApiKey || ''}
                    onChange={(e) => saveConfig({ geminiApiKey: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Chave API Groq</label>
                  <input
                    type="text"
                    value={cfg.groqApiKey || ''}
                    onChange={(e) => saveConfig({ groqApiKey: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
              </div>
            </div>

            {/* Configurações de Assinatura Eletrônica */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">✍️ Assinatura Eletrônica</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">E-mail remetente (para envio)</label>
                  <input
                    type="email"
                    value={cfg.emailRemetente || ''}
                    onChange={(e) => saveConfig({ emailRemetente: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Host SMTP</label>
                  <input
                    type="text"
                    value={cfg.emailConfig?.smtpHost || ''}
                    onChange={(e) => saveConfig({ emailConfig: { ...cfg.emailConfig, smtpHost: e.target.value } })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Porta SMTP</label>
                  <input
                    type="number"
                    value={cfg.emailConfig?.smtpPort || 587}
                    onChange={(e) => saveConfig({ emailConfig: { ...cfg.emailConfig, smtpPort: parseInt(e.target.value) } })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Usuário SMTP</label>
                  <input
                    type="text"
                    value={cfg.emailConfig?.smtpUser || ''}
                    onChange={(e) => saveConfig({ emailConfig: { ...cfg.emailConfig, smtpUser: e.target.value } })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Senha SMTP</label>
                  <input
                    type="password"
                    value={cfg.emailConfig?.smtpPass || ''}
                    onChange={(e) => saveConfig({ emailConfig: { ...cfg.emailConfig, smtpPass: e.target.value } })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          to: cfg.emailRemetente || userProfile?.email,
                          subject: 'Teste de Conexão SMTP Vivanexa',
                          html: '<p>Este é um e-mail de teste enviado do seu sistema Vivanexa.</p>',
                          config: cfg.emailConfig,
                        }),
                      });
                      if (res.ok) {
                        alert('Conexão SMTP testada com sucesso! Verifique sua caixa de entrada.');
                      } else {
                        const errorData = await res.json();
                        alert(`Falha no teste de conexão SMTP: ${errorData.error}`);
                      }
                    } catch (error) {
                      alert(`Erro ao testar conexão SMTP: ${error.message}`);
                    }
                  }}
                  className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  🔌 Testar Conexão SMTP
                </button>
              </div>
            </div>

            {/* Produtos e Planos */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">📦 Produtos e Planos</h4>
              <div className="space-y-4">
                <button onClick={() => setShowAddProductModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">➕ Novo Produto</button>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Nome</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">ID/Chave</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(cfg.productNames).map(([id, name]) => (
                        <tr key={id}>
                          <td className="py-2 px-4 border-b border-gray-600">{name}</td>
                          <td className="py-2 px-4 border-b border-gray-600">{id}</td>
                          <td className="py-2 px-4 border-b border-gray-600">
                            <button onClick={() => { setEditingProduct({ id, name, prices: cfg.prices[id] || {}, noAdesao: ALL_MODS.includes(id) && cfg.prices[id]?.[Object.keys(cfg.prices[id])[0]]?.[0] === 0, basicProTopOnly: ['IF', 'EP'].includes(id) }); setShowEditProductModal(true); }} className="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                            <button onClick={() => {
                              if (confirm(`Tem certeza que deseja remover o produto "${name}"?`)) {
                                const newProductNames = { ...cfg.productNames };
                                delete newProductNames[id];
                                const newPrices = { ...cfg.prices };
                                delete newPrices[id];
                                saveConfig({ productNames: newProductNames, prices: newPrices });
                              }
                            }} className="text-red-400 hover:text-red-300">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button onClick={() => setShowAddPlanModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">➕ Novo Plano</button>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Nome</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">ID/Chave</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Max CNPJs</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Usuários</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfg.plans.map(plan => (
                        <tr key={plan.id}>
                          <td className="py-2 px-4 border-b border-gray-600">{plan.name}</td>
                          <td className="py-2 px-4 border-b border-gray-600">{plan.id}</td>
                          <td className="py-2 px-4 border-b border-gray-600">{plan.maxCnpjs}</td>
                          <td className="py-2 px-4 border-b border-gray-600">{plan.unlimitedUsers ? 'Ilimitados' : plan.users}</td>
                          <td className="py-2 px-4 border-b border-gray-600">
                            <button onClick={() => {
                              if (confirm(`Tem certeza que deseja remover o plano "${plan.name}"?`)) {
                                saveConfig({ plans: cfg.plans.filter(p => p.id !== plan.id) });
                              }
                            }} className="text-red-400 hover:text-red-300">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modo de Desconto */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">🏷️ Descontos</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Modo de Desconto</label>
                  <select
                    value={cfg.discMode}
                    onChange={(e) => saveConfig({ discMode: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  >
                    <option value="screen">Desconto em Tela (mostra desconto após o preço cheio)</option>
                    <option value="voucher">Somente via Voucher (desconto só é aplicado com código de voucher válido)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">% Adesão (tela)</label>
                  <input
                    type="number"
                    value={cfg.discAdPct}
                    onChange={(e) => saveConfig({ discAdPct: parseInt(e.target.value) })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">% Mensalidade (tela)</label>
                  <input
                    type="number"
                    value={cfg.discMenPct}
                    onChange={(e) => saveConfig({ discMenPct: parseInt(e.target.value) })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">% Adesão (fechamento)</label>
                  <input
                    type="number"
                    value={cfg.discClosePct}
                    onChange={(e) => saveConfig({ discClosePct: parseInt(e.target.value) })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
              </div>
            </div>

            {/* Vouchers */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">🎫 Vouchers</h4>
              <button onClick={() => setShowVoucherModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">➕ Gerar Novo Voucher</button>
              <div className="overflow-x-auto mt-4">
                <table className="min-w-full bg-gray-700 rounded-lg">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Código</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">% Adesão</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">% Mensalidade</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Expira em</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.vouchers.map(voucher => (
                      <tr key={voucher.code}>
                        <td className="py-2 px-4 border-b border-gray-600">{voucher.code}</td>
                        <td className="py-2 px-4 border-b border-gray-600">{voucher.discAdPct}%</td>
                        <td className="py-2 px-4 border-b border-gray-600">{voucher.discMenPct}%</td>
                        <td className="py-2 px-4 border-b border-gray-600">{voucher.expiresAt || 'Nunca'}</td>
                        <td className="py-2 px-4 border-b border-gray-600">
                          <button onClick={() => {
                            if (confirm(`Tem certeza que deseja remover o voucher "${voucher.code}"?`)) {
                              saveConfig({ vouchers: cfg.vouchers.filter(v => v.code !== voucher.code) });
                            }
                          }} className="text-red-400 hover:text-red-300">Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modelos de Documentos */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">📄 Modelos de Documentos</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Modelo de Proposta Comercial</label>
                  <button onClick={() => { setEditingDocType('proposta'); setEditingDocContent(cfg.propostaTemplate || ''); setShowEditDocModal(true); }} className="ml-2 px-3 py-1 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">✏️ Editar</button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Modelo de Contrato</label>
                  <button onClick={() => { setEditingDocType('contrato'); setEditingDocContent(cfg.contractTemplate || ''); setShowEditDocModal(true); }} className="ml-2 px-3 py-1 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">✏️ Editar</button>
                </div>
              </div>
            </div>

            {/* Usuários */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">👥 Usuários</h4>
              <button onClick={() => { setNewUserData({ nome: '', email: '', telefone: '', perfil: 'padrao', password: '', signature: null, signatureImage: null }); setShowAddUserModal(true); }} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">➕ Novo Usuário</button>
              <div className="overflow-x-auto mt-4">
                <table className="min-w-full bg-gray-700 rounded-lg">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Nome</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">E-mail</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Perfil</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.users.map(user => (
                      <tr key={user.id}>
                        <td className="py-2 px-4 border-b border-gray-600">{user.nome}</td>
                        <td className="py-2 px-4 border-b border-gray-600">{user.email}</td>
                        <td className="py-2 px-4 border-b border-gray-600">{user.perfil}</td>
                        <td className="py-2 px-4 border-b border-gray-600">
                          <button onClick={() => { setEditingUser(user); setShowEditUserModal(true); }} className="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                          <button onClick={() => {
                            if (confirm(`Tem certeza que deseja remover o usuário "${user.nome}"?`)) {
                              saveConfig({ users: cfg.users.filter(u => u.id !== user.id) });
                            }
                          }} className="text-red-400 hover:text-red-300">Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Clientes */}
            <div className="mb-8">
              <h4 className="font-semibold mb-3 text-blue-400">🗃️ Clientes</h4>
              <button onClick={() => { setEditingClient(null); setShowClientModal(true); }} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">➕ Novo Cliente</button>
              <div className="overflow-x-auto mt-4">
                <table className="min-w-full bg-gray-700 rounded-lg">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Nome Fantasia</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">CNPJ/CPF</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Contato</th>
                      <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.clients.map(client => (
                      <tr key={client.id}>
                        <td className="py-2 px-4 border-b border-gray-600">{client.nomeFantasia}</td>
                        <td className="py-2 px-4 border-b border-gray-600">{fmtDoc(client.cnpj)}</td>
                        <td className="py-2 px-4 border-b border-gray-600">{client.contatoNome}</td>
                        <td className="py-2 px-4 border-b border-gray-600">
                          <button onClick={() => { setEditingClient(client); setShowClientModal(true); }} className="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                          <button onClick={() => {
                            if (confirm(`Tem certeza que deseja remover o cliente "${client.nomeFantasia}"?`)) {
                              saveConfig({ clients: cfg.clients.filter(c => c.id !== client.id) });
                            }
                          }} className="text-red-400 hover:text-red-300">Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setShowConfigModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Client Search Modal */}
      {showClientSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">🔍 Buscar / Cadastrar Cliente</h3>
            <button onClick={() => setShowClientSearchModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="flex mb-4 space-x-2">
              <input
                type="text"
                placeholder="Buscar por nome, CNPJ, CPF ou e-mail..."
                value={clientSearchTerm}
                onChange={(e) => {
                  setClientSearchTerm(e.target.value);
                  const term = e.target.value.toLowerCase();
                  setFilteredClients(
                    cfg.clients.filter(client =>
                      client.nomeFantasia.toLowerCase().includes(term) ||
                      client.cnpj.includes(clean(term)) ||
                      client.contatoCpf.includes(clean(term)) ||
                      client.contatoEmail.toLowerCase().includes(term)
                    )
                  );
                }}
                className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
              <button onClick={() => { setEditingClient(null); setShowClientModal(true); setShowClientSearchModal(false); }} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">➕ Novo Cliente</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-700 rounded-lg">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Nome Fantasia</th>
                    <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">CNPJ/CPF</th>
                    <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Contato</th>
                    <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(clientSearchTerm ? filteredClients : cfg.clients).map(client => (
                    <tr key={client.id}>
                      <td className="py-2 px-4 border-b border-gray-600">{client.nomeFantasia}</td>
                      <td className="py-2 px-4 border-b border-gray-600">{fmtDoc(client.cnpj)}</td>
                      <td className="py-2 px-4 border-b border-gray-600">{client.contatoNome}</td>
                      <td className="py-2 px-4 border-b border-gray-600">
                        <button onClick={() => handleSelectClient(client)} className="text-green-400 hover:text-green-300 mr-2">Selecionar</button>
                        <button onClick={() => { setEditingClient(client); setShowClientModal(true); setShowClientSearchModal(false); }} className="text-blue-400 hover:text-blue-300">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setShowClientSearchModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Client Modal (Add/Edit) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setShowClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <ClientForm clientData={editingClient} onSave={handleSaveClient} onCancel={() => setShowClientModal(false)} cfg={cfg} />
          </div>
        </div>
      )}

      {/* Quote Modal */}
      {showQuoteModal && currentQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📋 Cotação</h3>
            <button onClick={() => setShowQuoteModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            {currentClient && (
              <div className="mb-4 p-3 bg-gray-700 rounded-md text-sm">
                <p><strong>Cliente:</strong> {currentClient.nomeFantasia} ({fmtDoc(currentClient.cnpj)})</p>
                <p><strong>Contato:</strong> {currentClient.contatoNome} ({currentClient.contatoEmail})</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300">Tipo de Cotação:</label>
              <select
                value={quoteType}
                onChange={(e) => {
                  setQuoteType(e.target.value);
                  const { modules, planId, ifPlan, cnpjs, notas } = currentDoc.data;
                  let newQuote;
                  if (e.target.value === 'full') newQuote = calcQuoteFullPrice(modules, planId, ifPlan, cnpjs, notas, cfg);
                  else if (e.target.value === 'discount') newQuote = calcQuoteWithDiscount(modules, planId, ifPlan, cnpjs, notas, cfg);
                  else newQuote = calcClosing(modules, planId, ifPlan, cnpjs, notas, cfg);
                  setCurrentQuote(newQuote);
                  setCurrentDoc(prev => ({ ...prev, data: { ...prev.data, quote: newQuote } }));
                }}
                className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="full">Preço Cheio</option>
                <option value="discount">Com Desconto (Tela)</option>
                <option value="closing">Fechamento (Desconto Extra)</option>
              </select>
            </div>

            {cfg.discMode === 'voucher' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300">Voucher:</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={quoteVoucher}
                    onChange={(e) => setQuoteVoucher(e.target.value)}
                    placeholder="Código do Voucher"
                    className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                  <button onClick={() => {
                    const voucher = cfg.vouchers.find(v => v.code === quoteVoucher);
                    if (voucher) {
                      if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
                        setQuoteVoucherError('Voucher expirado.');
                        setQuoteVoucherData(null);
                      } else {
                        setQuoteVoucherData(voucher);
                        setQuoteVoucherError('');
                        const { modules, planId, ifPlan, cnpjs, notas } = currentDoc.data;
                        const newCfg = { ...cfg, discAdPct: voucher.discAdPct, discMenPct: voucher.discMenPct };
                        const newQuote = calcQuoteWithDiscount(modules, planId, ifPlan, cnpjs, notas, newCfg);
                        setCurrentQuote(newQuote);
                        setCurrentDoc(prev => ({ ...prev, data: { ...prev.data, quote: newQuote, voucher: voucher.code } }));
                      }
                    } else {
                      setQuoteVoucherError('Voucher inválido.');
                      setQuoteVoucherData(null);
                    }
                  }} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Aplicar</button>
                </div>
                {quoteVoucherError && <p className="text-red-500 text-sm mt-1">{quoteVoucherError}</p>}
                {quoteVoucherData && <p className="text-green-500 text-sm mt-1">Voucher aplicado: {quoteVoucherData.discAdPct}% Adesão, {quoteVoucherData.discMenPct}% Mensalidade.</p>}
              </div>
            )}

            <div className="overflow-x-auto mb-4">
              <table className="min-w-full bg-gray-700 rounded-lg">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Módulo</th>
                    <th className="py-2 px-4 border-b border-gray-600 text-right text-sm font-medium text-gray-300">Adesão</th>
                    <th className="py-2 px-4 border-b border-gray-600 text-right text-sm font-medium text-gray-300">Mensalidade</th>
                  </tr>
                </thead>
                <tbody>
                  {currentQuote.results.map((item, index) => (
                    <tr key={index}>
                      <td className="py-2 px-4 border-b border-gray-600">{item.name}</td>
                      <td className="py-2 px-4 border-b border-gray-600 text-right">{fmt(item.ad)}</td>
                      <td className="py-2 px-4 border-b border-gray-600 text-right">{fmt(item.men)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-600">
                    <td className="py-2 px-4 border-b border-gray-600">Total</td>
                    <td className="py-2 px-4 border-b border-gray-600 text-right">{fmt(currentQuote.tAd)}</td>
                    <td className="py-2 px-4 border-b border-gray-600 text-right">{fmt(currentQuote.tMen)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowQuoteModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
              <button onClick={() => {
                if (!currentClient) {
                  alert('Por favor, selecione um cliente antes de gerar o contrato.');
                  setShowClientSearchModal(true);
                  return;
                }
                setShowPaymentModal(true);
                setShowQuoteModal(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">📝 Gerar Contrato</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📝 Configurar Contrato</h3>
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <p className="text-gray-300 mb-4">Preencha os dados de pagamento antes de gerar o contrato.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">💳 Condição de Pagamento da Adesão</label>
                <select
                  value={paymentData.adesaoCondition}
                  onChange={(e) => setPaymentData({ ...paymentData, adesaoCondition: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="vista">Pagamento à vista</option>
                  <option value="pix_boleto">PIX ou Boleto à vista</option>
                  <option value="cartao">Cartão de Crédito — sem juros</option>
                  <option value="boleto_parcelado">Boleto parcelado — sem juros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">📅 Vencimento da Adesão</label>
                <select
                  value={paymentData.adesaoDueDate}
                  onChange={(e) => setPaymentData({ ...paymentData, adesaoDueDate: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Selecione...</option>
                  {getNextDates().map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                  <option value="outra">Outra data:</option>
                </select>
                {paymentData.adesaoDueDate === 'outra' && (
                  <input
                    type="date"
                    value={paymentData.outraAdesaoDate}
                    onChange={(e) => setPaymentData({ ...paymentData, outraAdesaoDate: e.target.value })}
                    className="mt-2 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">📅 Vencimento da Mensalidade</label>
                <select
                  value={paymentData.mensalidadeDueDate}
                  onChange={(e) => setPaymentData({ ...paymentData, mensalidadeDueDate: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Selecione...</option>
                  {getNextDates().map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                  <option value="outra">Outra data:</option>
                </select>
                {paymentData.mensalidadeDueDate === 'outra' && (
                  <input
                    type="date"
                    value={paymentData.outraMensalidadeDate}
                    onChange={(e) => setPaymentData({ ...paymentData, outraMensalidadeDate: e.target.value })}
                    className="mt-2 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowPaymentModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleGenerateContract} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">Gerar Contrato</button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Modal (Display HTML) */}
      {showContractModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📄 Contrato Gerado</h3>
            <button onClick={() => setShowContractModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="bg-white p-6 rounded-lg text-gray-900 overflow-y-auto max-h-[60vh]" dangerouslySetInnerHTML={{ __html: contractHtml }}></div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowContractModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
              <button onClick={handleSendContractForSignature} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✉️ Enviar para Assinatura</button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Modal (for /sign/[token]) */}
      {showSignModal && signData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✍️ Assinatura Eletrônica</h3>
            <button onClick={() => setShowSignModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="bg-white p-6 rounded-lg text-gray-900 overflow-y-auto max-h-[60vh]" dangerouslySetInnerHTML={{ __html: buildContract(signData, cfg, userProfile) }}></div>

            <div className="mt-6 p-4 bg-gray-700 rounded-lg space-y-4">
              <h4 className="font-semibold text-lg text-blue-400">Dados para Assinatura do Cliente</h4>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Completo *</label>
                <input type="text" value={signData.nome || ''} onChange={(e) => setSignData({ ...signData, nome: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">CPF *</label>
                <input type="text" value={signData.cpf || ''} onChange={(e) => setSignData({ ...signData, cpf: clean(e.target.value) })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail *</label>
                <input type="email" value={signData.email || ''} onChange={(e) => setSignData({ ...signData, email: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={signConsent}
                  onChange={(e) => setSignConsent(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-300">
                  Li e concordo com os termos e condições deste documento e autorizo o uso das minhas informações para fins de identificação desta assinatura eletrônica.
                </label>
              </div>

              <h4 className="font-semibold text-lg text-blue-400 mt-6">Assinaturas</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Assinatura do Consultor</label>
                  {consultorSignature ? (
                    <img src={consultorSignature} alt="Assinatura do Consultor" className="mt-2 max-w-full h-24 border border-gray-600 rounded-md" />
                  ) : (
                    <button onClick={() => { setSignatureFor('consultor'); setShowSignaturePad(true); }} className="mt-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✍️ Desenhar Assinatura</button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Assinatura do Cliente</label>
                  {clientSignature ? (
                    <img src={clientSignature} alt="Assinatura do Cliente" className="mt-2 max-w-full h-24 border border-gray-600 rounded-md" />
                  ) : (
                    <button onClick={() => { setSignatureFor('client'); setShowSignaturePad(true); }} className="mt-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✍️ Desenhar Assinatura</button>
                  )}
                </div>
              </div>

              {signError && <p className="text-red-500 text-sm mt-4 text-center">{signError}</p>}
              {signSuccess && <p className="text-green-500 text-sm mt-4 text-center">Contrato assinado com sucesso!</p>}

              <div className="flex justify-end space-x-4 mt-6">
                <button onClick={() => setShowSignModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button onClick={handleSignContract} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Assinar Documento</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <SignaturePad
            onSave={(dataURL) => {
              if (signatureFor === 'consultor') setConsultorSignature(dataURL);
              else if (signatureFor === 'client') setClientSignature(dataURL);
              setShowSignaturePad(false);
            }}
            onCancel={() => setShowSignaturePad(false)}
          />
        </div>
      )}

      {/* Edit Document Template Modal */}
      {showEditDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Modelo de {editingDocType === 'proposta' ? 'Proposta' : 'Contrato'}</h3>
            <button onClick={() => setShowEditDocModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <textarea
              value={editingDocContent}
              onChange={(e) => setEditingDocContent(e.target.value)}
              className="w-full h-96 p-3 bg-gray-900 border border-gray-600 rounded-md text-white font-mono text-sm"
              placeholder="Texto de abertura personalizado (HTML ou texto puro). Deixe vazio para usar o padrão."
            ></textarea>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowEditDocModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={() => {
                if (editingDocType === 'proposta') saveConfig({ propostaTemplate: editingDocContent });
                else saveConfig({ contractTemplate: editingDocContent });
                setShowEditDocModal(false);
              }} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✅ Salvar Modelo</button>
              <button onClick={() => {
                if (editingDocType === 'proposta') saveConfig({ propostaTemplate: '' }); // Reset para o padrão
                else saveConfig({ contractTemplate: '' }); // Reset para o padrão
                setEditingDocContent('');
                alert('Modelo restaurado para o padrão do sistema.');
              }} className="px-6 py-2 bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors">🔄 Usar Padrão</button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">➕ Novo Usuário</h3>
            <button onClick={() => setShowAddUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Completo</label>
                <input type="text" value={newUserData.nome} onChange={(e) => setNewUserData({ ...newUserData, nome: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input type="email" value={newUserData.email} onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input type="text" value={newUserData.telefone} onChange={(e) => setNewUserData({ ...newUserData, telefone: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Senha</label>
                <input type="password" value={newUserData.password} onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Perfil</label>
                <select value={newUserData.perfil} onChange={(e) => setNewUserData({ ...newUserData, perfil: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                  <option value="padrao">Padrão</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddUserModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={async () => {
                if (!newUserData.nome || !newUserData.email || !newUserData.password) {
                  alert('Nome, E-mail e Senha são obrigatórios.');
                  return;
                }
                // Criar usuário no Supabase Auth
                const { data: { user }, error } = await supabase.auth.signUp({
                  email: newUserData.email,
                  password: newUserData.password,
                  options: {
                    data: {
                      nome: newUserData.nome,
                      telefone: newUserData.telefone,
                      perfil: newUserData.perfil,
                      empresa_id: empresaId,
                    }
                  }
                });

                if (error) {
                  alert(`Erro ao criar usuário: ${error.message}`);
                  return;
                }

                // Salvar perfil no banco de dados (vx_storage)
                const newUserProfile = {
                  id: user.id,
                  nome: newUserData.nome,
                  email: newUserData.email,
                  telefone: newUserData.telefone,
                  perfil: newUserData.perfil,
                  empresa_id: empresaId,
                  signature: null,
                  signatureImage: null,
                };
                await saveConfig({ users: [...cfg.users, newUserProfile] });
                alert('Usuário criado com sucesso! Um e-mail de confirmação foi enviado.');
                setShowAddUserModal(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Adicionar Usuário</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Usuário</h3>
            <button onClick={() => setShowEditUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Completo</label>
                <input type="text" value={editingUser.nome} onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input type="email" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input type="text" value={editingUser.telefone} onChange={(e) => setEditingUser({ ...editingUser, telefone: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nova Senha (vazio = manter)</label>
                <input type="password" value={editingUser.password || ''} onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Perfil</label>
                <select value={editingUser.perfil} onChange={(e) => setEditingUser({ ...editingUser, perfil: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                  <option value="padrao">Padrão</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300">✍️ Assinatura do Consultor (aparece nos contratos)</label>
                {editingUser.signatureImage ? (
                  <img src={editingUser.signatureImage} alt="Assinatura do Consultor" className="mt-2 max-w-full h-24 border border-gray-600 rounded-md" />
                ) : (
                  <button onClick={() => { setSignatureFor('userProfile'); setShowSignaturePad(true); }} className="mt-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✍️ Desenhar</button>
                )}
                {editingUser.signatureImage && (
                  <button onClick={() => setEditingUser({ ...editingUser, signatureImage: null })} className="ml-2 px-3 py-1 bg-red-600 rounded-lg hover:bg-red-700 transition-colors text-sm">🗑 Limpar</button>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowEditUserModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={async () => {
                const updatedUsers = cfg.users.map(u => u.id === editingUser.id ? editingUser : u);
                await saveConfig({ users: updatedUsers });

                // Atualizar senha no Supabase Auth se fornecida
                if (editingUser.password) {
                  const { error } = await supabase.auth.updateUser({ password: editingUser.password });
                  if (error) {
                    alert(`Erro ao atualizar senha: ${error.message}`);
                  } else {
                    alert('Senha atualizada com sucesso!');
                  }
                }
                alert('Usuário atualizado com sucesso!');
                setShowEditUserModal(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📦 Novo Produto</h3>
            <button onClick={() => setShowAddProductModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Produto</label>
                <input type="text" value={newProductData.name} onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value, id: e.target.value.replace(/\s/g, '') })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">ID/Chave (automático)</label>
                <input type="text" value={newProductData.id} disabled className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400" />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newProductData.noAdesao}
                  onChange={(e) => setNewProductData({ ...newProductData, noAdesao: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-300">Sem adesão (módulo como CND)</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newProductData.basicProTopOnly}
                  onChange={(e) => setNewProductData({ ...newProductData, basicProTopOnly: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-300">Apenas planos Basic/Pro/Top (como IF/EP)</label>
              </div>
              <h4 className="font-semibold mt-4 mb-2">PREÇOS POR PLANO (Adesão | Mensalidade)</h4>
              {cfg.plans.map(plan => (
                <div key={plan.id} className="flex items-center space-x-2">
                  <label className="w-24 text-sm text-gray-300">{plan.name}</label>
                  <input
                    type="number"
                    placeholder="Adesão"
                    value={newProductData.prices[plan.id]?.[0] || ''}
                    onChange={(e) => setNewProductData(prev => ({
                      ...prev,
                      prices: {
                        ...prev.prices,
                        [plan.id]: [parseFloat(e.target.value || 0), prev.prices[plan.id]?.[1] || 0]
                      }
                    }))}
                    disabled={newProductData.noAdesao}
                    className="flex-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                  <input
                    type="number"
                    placeholder="Mensalidade"
                    value={newProductData.prices[plan.id]?.[1] || ''}
                    onChange={(e) => setNewProductData(prev => ({
                      ...prev,
                      prices: {
                        ...prev.prices,
                        [plan.id]: [prev.prices[plan.id]?.[0] || 0, parseFloat(e.target.value || 0)]
                      }
                    }))}
                    className="flex-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddProductModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={() => {
                if (!newProductData.name || !newProductData.id) {
                  alert('Nome e ID do produto são obrigatórios.');
                  return;
                }
                if (cfg.productNames[newProductData.id]) {
                  alert('Já existe um produto com este ID/Chave.');
                  return;
                }
                const updatedProductNames = { ...cfg.productNames, [newProductData.id]: newProductData.name };
                const updatedPrices = { ...cfg.prices, [newProductData.id]: newProductData.prices };
                saveConfig({ productNames: updatedProductNames, prices: updatedPrices });
                setShowAddProductModal(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Adicionar Produto</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditProductModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Produto: {editingProduct.name}</h3>
            <button onClick={() => setShowEditProductModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Produto</label>
                <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">ID/Chave</label>
                <input type="text" value={editingProduct.id} disabled className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400" />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editingProduct.noAdesao}
                  onChange={(e) => setEditingProduct({ ...editingProduct, noAdesao: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-300">Sem adesão (módulo como CND)</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editingProduct.basicProTopOnly}
                  onChange={(e) => setEditingProduct({ ...editingProduct, basicProTopOnly: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-300">Apenas planos Basic/Pro/Top (como IF/EP)</label>
              </div>
              <h4 className="font-semibold mt-4 mb-2">PREÇOS POR PLANO (Adesão | Mensalidade)</h4>
              {cfg.plans.map(plan => (
                <div key={plan.id} className="flex items-center space-x-2">
                  <label className="w-24 text-sm text-gray-300">{plan.name}</label>
                  <input
                    type="number"
                    placeholder="Adesão"
                    value={editingProduct.prices[plan.id]?.[0] || ''}
                    onChange={(e) => setEditingProduct(prev => ({
                      ...prev,
                      prices: {
                        ...prev.prices,
                        [plan.id]: [parseFloat(e.target.value || 0), prev.prices[plan.id]?.[1] || 0]
                      }
                    }))}
                    disabled={editingProduct.noAdesao}
                    className="flex-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                  <input
                    type="number"
                    placeholder="Mensalidade"
                    value={editingProduct.prices[plan.id]?.[1] || ''}
                    onChange={(e) => setEditingProduct(prev => ({
                      ...prev,
                      prices: {
                        ...prev.prices,
                        [plan.id]: [prev.prices[plan.id]?.[0] || 0, parseFloat(e.target.value || 0)]
                      }
                    }))}
                    className="flex-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowEditProductModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={() => {
                const updatedProductNames = { ...cfg.productNames, [editingProduct.id]: editingProduct.name };
                const updatedPrices = { ...cfg.prices, [editingProduct.id]: editingProduct.prices };
                saveConfig({ productNames: updatedProductNames, prices: updatedPrices });
                setShowEditProductModal(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Produto</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">➕ Novo Plano</h3>
            <button onClick={() => setShowAddPlanModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Plano</label>
                <input
                  type="text"
                  value={newPlanData.name}
                  onChange={(e) => setNewPlanData({ ...newPlanData, name: e.target.value, id: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">ID/Chave (automático)</label>
                <input
                  type="text"
                  value={newPlanData.id}
                  disabled
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Máximo de CNPJs</label>
                <input
                  type="number"
                  value={newPlanData.maxCnpjs}
                  onChange={(e) => setNewPlanData({ ...newPlanData, maxCnpjs: parseInt(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                />
              </div>
              {!newPlanData.unlimitedUsers && (
                <div>
                  <label className="block text-sm font-medium text-gray-300">Número de Usuários</label>
                  <input
                    type="number"
                    value={newPlanData.users}
                    onChange={(e) => setNewPlanData({ ...newPlanData, users: parseInt(e.target.value) })}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newPlanData.unlimitedUsers}
                  onChange={(e) => setNewPlanData({ ...newPlanData, unlimitedUsers: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-300">Usuários Ilimitados?</label>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddPlanModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={() => {
                if (!newPlanData.name || !newPlanData.id || newPlanData.maxCnpjs <= 0) {
                  alert('Nome, ID e Máximo de CNPJs (maior que 0) são obrigatórios.');
                  return;
                }
                if (cfg.plans.some(p => p.id === newPlanData.id)) {
                  alert('Já existe um plano com este ID/Chave.');
                  return;
                }
                saveConfig({ plans: [...cfg.plans, newPlanData] });
                setShowAddPlanModal(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Adicionar Plano</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">🎫 Gerar Novo Voucher</h3>
            <button onClick={() => setShowVoucherModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Prefixo do Código (opcional)</label>
                <input type="text" value={newVoucherData.prefix} onChange={(e) => setNewVoucherData({ ...newVoucherData, prefix: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">% Adesão</label>
                <input type="number" value={newVoucherData.discAdPct} onChange={(e) => setNewVoucherData({ ...newVoucherData, discAdPct: parseInt(e.target.value) })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">% Mensalidade</label>
                <input type="number" value={newVoucherData.discMenPct} onChange={(e) => setNewVoucherData({ ...newVoucherData, discMenPct: parseInt(e.target.value) })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Expira em (opcional)</label>
                <input type="date" value={newVoucherData.expiresAt} onChange={(e) => setNewVoucherData({ ...newVoucherData, expiresAt: e.target.value })} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowVoucherModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={() => {
                const code = (newVoucherData.prefix || 'VIVANEXA') + Math.random().toString(36).substring(2, 8).toUpperCase();
                saveConfig({ vouchers: [...cfg.vouchers, { ...newVoucherData, code }] });
                setShowVoucherModal(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">🎫 Gerar Voucher</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">👑 Painel Master</h3>
            <button onClick={() => setShowAdminPanel(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            {!adminPassword ? (
              <div className="space-y-4">
                <p className="text-center text-gray-300">Acesso Master - Área restrita ao administrador do sistema</p>
                <div>
                  <label className="block text-sm font-medium text-gray-300">SENHA</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
                {adminError && <p className="text-red-500 text-sm text-center">{adminError}</p>}
                <div className="flex justify-end space-x-4 mt-6">
                  <button onClick={() => setShowAdminPanel(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                  <button onClick={async () => {
                    if (adminPassword === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) { // Use uma variável de ambiente para a senha
                      setAdminPassword('logged_in'); // Sinaliza que está logado
                      setAdminError('');
                    } else {
                      setAdminError('Senha incorreta.');
                    }
                  }} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">🔐 Entrar no Painel Master</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h4 className="font-semibold mb-3">⚠️ Área Administrativa — Limpeza de Dados</h4>
                <button onClick={() => { if (confirm('Tem certeza que deseja zerar o histórico de contratos e propostas? Esta ação é irreversível.')) saveConfig({ docHistory: [] }); }} className="w-full px-4 py-2 bg-red-700 rounded-lg hover:bg-red-800 transition-colors">🗑 Zerar histórico de contratos e propostas</button>
                <button onClick={() => { if (confirm('Tem certeza que deseja zerar as metas de todos os usuários? Esta ação é irreversível.')) saveConfig({ goals: [] }); }} className="w-full px-4 py-2 bg-red-700 rounded-lg hover:bg-red-800 transition-colors">🎯 Zerar metas de todos os usuários</button>
                <button onClick={() => { if (confirm('Tem certeza que deseja zerar o banco de clientes? Esta ação é irreversível.')) saveConfig({ clients: [] }); }} className="w-full px-4 py-2 bg-red-700 rounded-lg hover:bg-red-800 transition-colors">👥 Zerar banco de clientes</button>
                <button onClick={() => { if (confirm('⚠️ ATENÇÃO: Esta ação apagará TODAS as configurações e dados (exceto usuários Supabase) e restaurará os padrões. Esta ação é IRREVERSÍVEL. Tem certeza?')) { saveConfig(DEFAULT_CFG); alert('Reset completo realizado.'); } }} className="w-full px-4 py-2 bg-red-900 rounded-lg hover:bg-red-950 transition-colors font-bold">⚠️ RESET COMPLETO — Apagar tudo e restaurar padrões (IRREVERSÍVEL)</button>
                <div className="flex justify-end mt-6">
                  <button onClick={() => { setShowAdminPanel(false); setAdminPassword(''); }} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Sair</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📊 Relatórios</h3>
            <button onClick={() => setShowReportsModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <p>Conteúdo dos relatórios aqui. Em breve!</p>
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowReportsModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
