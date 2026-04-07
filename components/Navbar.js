// components/Navbar.js
import { useState } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [openMenu, setOpenMenu] = useState(null);

  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Início */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">V</span>
              </div>
              <span className="text-white font-semibold text-xl">Vivanexa</span>
            </Link>

            {/* Menu Principal */}
            <div className="flex items-center gap-6 text-sm">
              <Link href="/dashboard" className="text-white hover:text-cyan-400 transition-colors">Início</Link>

              <div className="relative group">
                <button
                  onClick={() => toggleMenu('comercial')}
                  className="flex items-center gap-1 text-white hover:text-cyan-400 transition-colors"
                >
                  Comercial
                </button>
                {/* submenu comercial se existir... */}
              </div>

              <div className="relative group">
                <button
                  onClick={() => toggleMenu('marketing')}
                  className="flex items-center gap-1 text-white hover:text-cyan-400 transition-colors"
                >
                  Marketing
                </button>
              </div>

              <div className="relative group">
                <button
                  onClick={() => toggleMenu('financeiro')}
                  className="flex items-center gap-1 text-white hover:text-cyan-400 transition-colors"
                >
                  Financeiro
                </button>
              </div>

              <div className="relative group">
                <button
                  onClick={() => toggleMenu('fiscal')}
                  className="flex items-center gap-1 text-white hover:text-cyan-400 transition-colors"
                >
                  Fiscal
                </button>
              </div>

              {/* ==================== PRODUTIVIDADE ==================== */}
              <div className="relative group">
                <button
                  onClick={() => toggleMenu('produtividade')}
                  className="flex items-center gap-1 text-white hover:text-cyan-400 transition-colors"
                >
                  <span>⚡</span> Produtividade
                </button>

                {openMenu === 'produtividade' && (
                  <div className="absolute left-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-2 z-50">
                    <Link
                      href="/produtividade/tarefas"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 text-white"
                      onClick={() => setOpenMenu(null)}
                    >
                      ✅ Tarefas e Obrigações
                    </Link>

                    <Link
                      href="/produtividade/gestao-mei"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 text-white"
                      onClick={() => setOpenMenu(null)}
                    >
                      🏢 Gestão MEI
                    </Link>
                  </div>
                )}
              </div>

              <Link href="/relatorios" className="text-white hover:text-cyan-400 transition-colors">Relatórios</Link>
              <Link href="/configuracoes" className="text-white hover:text-cyan-400 transition-colors">Config</Link>
            </div>
          </div>

          {/* Botões do lado direito */}
          <div className="flex items-center gap-4">
            <button className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
              Abrir Assistente
            </button>
            <button className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
              Lançar KPIs
            </button>

            <div className="flex items-center gap-3 pl-6 border-l border-gray-700">
              <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">
                T
              </div>
              <div>
                <p className="text-white text-sm">teste</p>
                <p className="text-gray-500 text-xs">Administrador</p>
              </div>
              <button className="ml-2 text-red-400 hover:text-red-500 text-sm">Sair</button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
