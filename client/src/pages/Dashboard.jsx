import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, formatCurrency, formatPercent, getProgressColor, getBadgeClass } from '../utils/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import * as XLSX from 'xlsx'

export default function Dashboard() {
  const { setorId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('nome')
  const [activeTab, setActiveTab] = useState('cards')
  const [activeFilter, setActiveFilter] = useState('todos') // todos, perto_subir, em_risco

  useEffect(() => {
    loadDashboard()
  }, [setorId])

  const loadDashboard = async () => {
    setLoading(true)
    setError('')

    try {
      const result = await api.getDashboard(setorId)
      setData(result)
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  // Export to Excel
  const exportToExcel = () => {
    if (!data || !data.revendedores) return

    const exportData = data.revendedores.map(rev => ({
      'Codigo': rev.codigoRevendedor,
      'Nome': rev.nomeRevendedora,
      'Segmento': rev.segmentacao.segmentoAtual,
      'Total Comprado': rev.totalGeral,
      'Progresso Manter (%)': rev.segmentacao.progressoManter,
      'Progresso Subir (%)': rev.segmentacao.progressoSubir,
      'Falta para Manter': rev.segmentacao.faltaManter,
      'Falta para Subir': rev.segmentacao.faltaSubir || '-',
      'Proximo Segmento': rev.segmentacao.proximoSegmento || '-',
      'Status': rev.segmentacao.emRisco ? 'EM RISCO' : (rev.segmentacao.progressoSubir >= 80 ? 'PERTO DE SUBIR' : 'NORMAL')
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Revendedores')

    // Auto-size columns
    const colWidths = [
      { wch: 10 }, // Codigo
      { wch: 35 }, // Nome
      { wch: 12 }, // Segmento
      { wch: 15 }, // Total
      { wch: 18 }, // Progresso Manter
      { wch: 18 }, // Progresso Subir
      { wch: 18 }, // Falta Manter
      { wch: 18 }, // Falta Subir
      { wch: 15 }, // Proximo
      { wch: 15 }  // Status
    ]
    ws['!cols'] = colWidths

    const fileName = `revendedores_setor_${setorId}_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">!</div>
        <h3>Erro ao carregar dashboard</h3>
        <p>{error}</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Voltar ao inicio
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <h3>Nenhum dado encontrado</h3>
        <p>Nao ha dados para o setor {setorId}</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Voltar ao inicio
        </Link>
      </div>
    )
  }

  // Filter by KPI card selection
  let filteredRevendedores = data.revendedores.filter(r => {
    // First apply KPI filter
    if (activeFilter === 'perto_subir' && r.segmentacao.progressoSubir < 80) return false
    if (activeFilter === 'em_risco' && !r.segmentacao.emRisco) return false

    // Then apply search
    if (searchTerm) {
      const matchesSearch = r.nomeRevendedora.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.codigoRevendedor.includes(searchTerm)
      if (!matchesSearch) return false
    }

    return true
  })

  // Sort
  filteredRevendedores = [...filteredRevendedores].sort((a, b) => {
    switch (sortBy) {
      case 'nome':
        return a.nomeRevendedora.localeCompare(b.nomeRevendedora)
      case 'total':
        return b.totalGeral - a.totalGeral
      case 'progresso_subir':
        return b.segmentacao.progressoSubir - a.segmentacao.progressoSubir
      case 'progresso_manter':
        return b.segmentacao.progressoManter - a.segmentacao.progressoManter
      case 'falta_subir':
        return (a.segmentacao.faltaSubir || Infinity) - (b.segmentacao.faltaSubir || Infinity)
      default:
        return 0
    }
  })

  // Get comparison data if available
  const getComparativo = (codigoRevendedor) => {
    if (!data.comparativo) return null
    return data.comparativo.revendedores.find(r => r.codigoRevendedor === codigoRevendedor)
  }

  // Chart data
  const chartData = filteredRevendedores.slice(0, 15).map(r => ({
    nome: r.nomeRevendedora.split(' ')[0],
    total: r.totalGeral
  }))

  // Handle KPI card click
  const handleKpiClick = (filter) => {
    if (activeFilter === filter) {
      setActiveFilter('todos') // Toggle off if same filter clicked
    } else {
      setActiveFilter(filter)
    }
  }

  // Get filter label
  const getFilterLabel = () => {
    switch (activeFilter) {
      case 'perto_subir': return 'Perto de Subir'
      case 'em_risco': return 'Em Risco'
      default: return null
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <Link to="/" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            &#8592; Voltar
          </Link>
          <h2>{data.setorNome || `Setor ${setorId}`}</h2>
        </div>

        <div className="dashboard-meta">
          <button
            className="btn btn-success btn-sm"
            onClick={exportToExcel}
            style={{ marginRight: '0.5rem' }}
          >
            Exportar Excel
          </button>
          <div className="snapshot-indicator">
            <span className={`dot ${data.snapshotAtivo}`}></span>
            Snapshot: {data.snapshotAtivo === 'manha' ? 'Manha' : 'Tarde'}
          </div>
          <div className="snapshot-indicator">
            Ciclo: {data.cicloAtual}
          </div>
        </div>
      </div>

      {/* KPIs - Clickable */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total do Setor</div>
          <div className="kpi-value">{formatCurrency(data.kpis.totalSetor)}</div>
        </div>
        <div
          className={`kpi-card kpi-clickable ${activeFilter === 'todos' ? 'kpi-active' : ''}`}
          onClick={() => handleKpiClick('todos')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-label">Revendedores</div>
          <div className="kpi-value">{data.kpis.qtdRevendedores}</div>
        </div>
        <div
          className={`kpi-card kpi-clickable ${activeFilter === 'perto_subir' ? 'kpi-active' : ''}`}
          onClick={() => handleKpiClick('perto_subir')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-label">Perto de Subir</div>
          <div className="kpi-value success">{data.kpis.pertoDeSurbir}</div>
        </div>
        <div
          className={`kpi-card kpi-clickable ${activeFilter === 'em_risco' ? 'kpi-active' : ''}`}
          onClick={() => handleKpiClick('em_risco')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-label">Em Risco</div>
          <div className="kpi-value danger">{data.kpis.emRisco}</div>
        </div>
        {data.comparativo && (
          <div className="kpi-card">
            <div className="kpi-label">Crescimento Hoje</div>
            <div className={`kpi-value ${data.comparativo.deltaSetor > 0 ? 'success' : 'danger'}`}>
              {data.comparativo.deltaSetor > 0 ? '+' : ''}{formatCurrency(data.comparativo.deltaSetor)}
            </div>
          </div>
        )}
      </div>

      {/* Active filter indicator */}
      {activeFilter !== 'todos' && (
        <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Filtro ativo: <strong>{getFilterLabel()}</strong> ({filteredRevendedores.length} revendedores)
          </span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setActiveFilter('todos')}
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          Cards
        </div>
        <div
          className={`tab ${activeTab === 'tabela' ? 'active' : ''}`}
          onClick={() => setActiveTab('tabela')}
        >
          Tabela
        </div>
        <div
          className={`tab ${activeTab === 'grafico' ? 'active' : ''}`}
          onClick={() => setActiveTab('grafico')}
        >
          Grafico
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          className="form-input search-input"
          placeholder="Buscar por nome ou codigo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="nome">Ordenar por Nome</option>
          <option value="total">Maior Total</option>
          <option value="progresso_subir">Mais perto de Subir</option>
          <option value="progresso_manter">Mais perto de Manter</option>
          <option value="falta_subir">Menor valor para Subir</option>
        </select>
      </div>

      {/* Content based on tab */}
      {activeTab === 'cards' && (
        <div className="revendedor-grid">
          {filteredRevendedores.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <p>Nenhum revendedor encontrado com os filtros atuais</p>
            </div>
          ) : (
            filteredRevendedores.map(rev => {
              const comp = getComparativo(rev.codigoRevendedor)
              return (
                <RevendedorCard
                  key={rev.codigoRevendedor}
                  revendedor={rev}
                  comparativo={comp}
                />
              )
            })
          )}
        </div>
      )}

      {activeTab === 'tabela' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Nome</th>
                  <th>Segmento</th>
                  <th>Total</th>
                  <th>Progresso Manter</th>
                  <th>Progresso Subir</th>
                  <th>Falta Subir</th>
                  {data.comparativo && <th>Hoje</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRevendedores.length === 0 ? (
                  <tr>
                    <td colSpan={data.comparativo ? 8 : 7} style={{ textAlign: 'center', padding: '2rem' }}>
                      Nenhum revendedor encontrado com os filtros atuais
                    </td>
                  </tr>
                ) : (
                  filteredRevendedores.map(rev => {
                    const comp = getComparativo(rev.codigoRevendedor)
                    return (
                      <tr key={rev.codigoRevendedor}>
                        <td>{rev.codigoRevendedor}</td>
                        <td>{rev.nomeRevendedora}</td>
                        <td>
                          <span className={`badge ${getBadgeClass(rev.segmentacao.segmentoAtual)}`}>
                            {rev.segmentacao.segmentoAtual}
                          </span>
                        </td>
                        <td>{formatCurrency(rev.totalGeral)}</td>
                        <td>{formatPercent(rev.segmentacao.progressoManter)}</td>
                        <td>{formatPercent(rev.segmentacao.progressoSubir)}</td>
                        <td>
                          {rev.segmentacao.faltaSubir !== null
                            ? formatCurrency(rev.segmentacao.faltaSubir)
                            : '-'}
                        </td>
                        {data.comparativo && (
                          <td>
                            {comp && (
                              <span className={`delta ${comp.delta > 0 ? 'positive' : comp.delta < 0 ? 'negative' : 'neutral'}`}>
                                {comp.delta > 0 ? '+' : ''}{formatCurrency(comp.delta)}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'grafico' && (
        <div className="card">
          <div className="card-header">
            <h2>Top 15 Revendedores por Total</h2>
          </div>
          <div className="card-body" style={{ height: '400px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="nome" width={100} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="total" fill="var(--primary)">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${240 + index * 8}, 70%, 60%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

function RevendedorCard({ revendedor, comparativo }) {
  const seg = revendedor.segmentacao

  return (
    <div className="revendedor-card">
      <div className="revendedor-header">
        <div className="revendedor-info">
          <h3>{revendedor.nomeRevendedora}</h3>
          <span className="codigo">#{revendedor.codigoRevendedor}</span>
        </div>
        <span className={`badge ${getBadgeClass(seg.segmentoAtual)}`}>
          {seg.segmentoAtual}
        </span>
      </div>

      <div className="revendedor-body">
        <div className="revendedor-total">
          {formatCurrency(revendedor.totalGeral)}
          {comparativo && comparativo.delta !== 0 && (
            <span className={`delta ${comparativo.delta > 0 ? 'positive' : 'negative'}`} style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
              {comparativo.delta > 0 ? '+ ' : ''}{formatCurrency(comparativo.delta)} hoje
            </span>
          )}
        </div>

        {/* Progress to maintain */}
        <div className="revendedor-meta">
          <div className="revendedor-meta-label">
            <span>Manter {seg.segmentoAtual}</span>
            <span>{formatPercent(seg.progressoManter)}</span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-bar-fill ${getProgressColor(seg.progressoManter)}`}
              style={{ width: `${Math.min(100, seg.progressoManter)}%` }}
            />
          </div>
          {seg.faltaManter > 0 && (
            <div className="revendedor-falta">
              Faltam <strong>{formatCurrency(seg.faltaManter)}</strong> para manter
            </div>
          )}
        </div>

        {/* Progress to upgrade */}
        {seg.proximoSegmento && (
          <div className="revendedor-meta">
            <div className="revendedor-meta-label">
              <span>Subir para {seg.proximoSegmento}</span>
              <span>{formatPercent(seg.progressoSubir)}</span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-bar-fill info`}
                style={{ width: `${Math.min(100, seg.progressoSubir)}%` }}
              />
            </div>
            <div className="revendedor-falta">
              Faltam <strong>{formatCurrency(seg.faltaSubir)}</strong> para subir
            </div>
          </div>
        )}

        {/* Impulso */}
        <div className={`revendedor-impulso ${seg.impulsoTipo}`}>
          {seg.impulso}
        </div>

        {/* Risk warning */}
        {seg.emRisco && (
          <div className="alert alert-warning" style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
            Atencao: Se nao atingir a meta, pode cair para <strong>{seg.segmentoQueda}</strong>
          </div>
        )}
      </div>
    </div>
  )
}
