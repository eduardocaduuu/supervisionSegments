import { useState, useEffect, useRef } from 'react'
import { api, formatDate } from '../utils/api'

const CICLOS = [
  '01/2026', '02/2026', '03/2026', '04/2026', '05/2026',
  '06/2026', '07/2026', '08/2026', '09/2026'
]

export default function AdminPanel() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingManha, setUploadingManha] = useState(false)
  const [uploadingTarde, setUploadingTarde] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const manhaInputRef = useRef(null)
  const tardeInputRef = useRef(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const data = await api.getConfig()
      setConfig(data)
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao carregar configuracoes' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      await api.updateConfig({
        cicloAtual: config.cicloAtual,
        snapshotAtivo: config.snapshotAtivo,
        representatividade: config.representatividade,
        riscoPercentual: config.riscoPercentual
      })
      setMessage({ type: 'success', text: 'Configuracoes salvas com sucesso!' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao salvar configuracoes' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (slot, file) => {
    if (!file) return

    const setUploading = slot === 'manha' ? setUploadingManha : setUploadingTarde
    setUploading(true)
    setMessage({ type: '', text: '' })

    try {
      await api.uploadCSV(file, slot)
      setMessage({ type: 'success', text: `CSV ${slot} carregado com sucesso!` })
      loadConfig() // Reload to get new file info
    } catch (err) {
      setMessage({ type: 'error', text: `Erro ao carregar CSV: ${err.message}` })
    } finally {
      setUploading(false)
    }
  }

  const handleRepresentatividadeChange = (ciclo, value) => {
    const numValue = parseFloat(value) || 0
    setConfig(prev => ({
      ...prev,
      representatividade: {
        ...prev.representatividade,
        [ciclo]: numValue
      }
    }))
  }

  const totalRepresentatividade = config?.representatividade
    ? Object.values(config.representatividade).reduce((sum, v) => sum + v, 0)
    : 0

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--gray-800)' }}>
        Painel Administrativo
      </h2>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="admin-grid">
        {/* Upload de CSVs */}
        <div className="card">
          <div className="card-header">
            <h2>Upload de CSVs</h2>
          </div>
          <div className="card-body">
            {/* Manha */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--gray-700)' }}>
                Snapshot Manha (08:00)
              </h3>
              <input
                type="file"
                ref={manhaInputRef}
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => handleUpload('manha', e.target.files[0])}
              />
              <div
                className={`upload-zone ${uploadingManha ? 'active' : ''}`}
                onClick={() => !uploadingManha && manhaInputRef.current?.click()}
              >
                <div className="upload-icon">AM</div>
                <p>{uploadingManha ? 'Carregando...' : 'Clique para fazer upload do CSV da manha'}</p>
                {config?.snapshots?.manha && (
                  <div className="file-info">
                    <strong>Arquivo atual:</strong><br />
                    Tamanho: {(config.snapshots.manha.size / 1024).toFixed(1)} KB<br />
                    Atualizado: {formatDate(config.snapshots.manha.modified)}
                  </div>
                )}
              </div>
            </div>

            {/* Tarde */}
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--gray-700)' }}>
                Snapshot Tarde (17:30)
              </h3>
              <input
                type="file"
                ref={tardeInputRef}
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => handleUpload('tarde', e.target.files[0])}
              />
              <div
                className={`upload-zone ${uploadingTarde ? 'active' : ''}`}
                onClick={() => !uploadingTarde && tardeInputRef.current?.click()}
              >
                <div className="upload-icon">PM</div>
                <p>{uploadingTarde ? 'Carregando...' : 'Clique para fazer upload do CSV da tarde'}</p>
                {config?.snapshots?.tarde && (
                  <div className="file-info">
                    <strong>Arquivo atual:</strong><br />
                    Tamanho: {(config.snapshots.tarde.size / 1024).toFixed(1)} KB<br />
                    Atualizado: {formatDate(config.snapshots.tarde.modified)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Configuracoes Gerais */}
        <div className="card">
          <div className="card-header">
            <h2>Configuracoes Gerais</h2>
          </div>
          <div className="card-body">
            <div className="config-item">
              <label>Ciclo Atual</label>
              <select
                value={config?.cicloAtual || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, cicloAtual: e.target.value }))}
              >
                {CICLOS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="config-item">
              <label>Snapshot Ativo</label>
              <select
                value={config?.snapshotAtivo || 'tarde'}
                onChange={(e) => setConfig(prev => ({ ...prev, snapshotAtivo: e.target.value }))}
              >
                <option value="manha">Manha</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>

            <div className="config-item">
              <label>% Risco (alerta)</label>
              <input
                type="number"
                value={config?.riscoPercentual || 30}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  riscoPercentual: parseInt(e.target.value) || 30
                }))}
                min="0"
                max="100"
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveConfig}
                disabled={saving}
                style={{ width: '100%' }}
              >
                {saving ? 'Salvando...' : 'Salvar Configuracoes'}
              </button>
            </div>
          </div>
        </div>

        {/* Representatividade por Ciclo */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <h2>Representatividade por Ciclo (%)</h2>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
              Define o peso de cada ciclo na meta total dos 9 ciclos. O total deve somar 100%.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              {CICLOS.map(ciclo => (
                <div key={ciclo} style={{ textAlign: 'center' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: 'var(--gray-700)',
                    marginBottom: '0.5rem'
                  }}>
                    {ciclo}
                  </label>
                  <input
                    type="number"
                    value={config?.representatividade?.[ciclo] || 0}
                    onChange={(e) => handleRepresentatividadeChange(ciclo, e.target.value)}
                    min="0"
                    max="100"
                    step="1"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius)',
                      textAlign: 'center'
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{
              padding: '0.75rem',
              background: totalRepresentatividade === 100 ? 'var(--gray-100)' : '#fef3c7',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              Total: {totalRepresentatividade}%
              {totalRepresentatividade !== 100 && (
                <span style={{ color: 'var(--warning)', marginLeft: '0.5rem' }}>
                  (deve ser 100%)
                </span>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveConfig}
                disabled={saving}
                style={{ width: '100%' }}
              >
                {saving ? 'Salvando...' : 'Salvar Representatividade'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Regras de Segmentacao */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2>Regras de Segmentacao (Referencia)</h2>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th>Minimo para Manter</th>
                  <th>Minimo para Subir</th>
                  <th>Cor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge badge-iniciante">Iniciante</span></td>
                  <td>R$ 0,00</td>
                  <td>R$ 2.999,99 (Bronze)</td>
                  <td style={{ background: '#9CA3AF', width: '30px' }}></td>
                </tr>
                <tr>
                  <td><span className="badge badge-bronze">Bronze</span></td>
                  <td>R$ 2.999,99</td>
                  <td>R$ 3.000,00 (Prata)</td>
                  <td style={{ background: '#CD7F32', width: '30px' }}></td>
                </tr>
                <tr>
                  <td><span className="badge badge-prata">Prata</span></td>
                  <td>R$ 3.000,00</td>
                  <td>R$ 9.000,00 (Ouro)</td>
                  <td style={{ background: '#C0C0C0', width: '30px' }}></td>
                </tr>
                <tr>
                  <td><span className="badge badge-ouro">Ouro</span></td>
                  <td>R$ 9.000,00</td>
                  <td>R$ 20.000,00 (Platina)</td>
                  <td style={{ background: '#FFD700', width: '30px' }}></td>
                </tr>
                <tr>
                  <td><span className="badge badge-platina">Platina</span></td>
                  <td>R$ 20.000,00</td>
                  <td>R$ 50.000,00 (Rubi)</td>
                  <td style={{ background: '#E5E4E2', width: '30px' }}></td>
                </tr>
                <tr>
                  <td><span className="badge badge-rubi">Rubi</span></td>
                  <td>R$ 50.000,00</td>
                  <td>R$ 80.000,00 (Esmeralda)</td>
                  <td style={{ background: '#E0115F', width: '30px' }}></td>
                </tr>
                <tr>
                  <td><span className="badge badge-esmeralda">Esmeralda</span></td>
                  <td>R$ 80.000,00</td>
                  <td>R$ 130.000,00 (Diamante)</td>
                  <td style={{ background: '#50C878', width: '30px' }}></td>
                </tr>
                <tr>
                  <td><span className="badge badge-diamante">Diamante</span></td>
                  <td>R$ 130.000,00</td>
                  <td>-</td>
                  <td style={{ background: '#B9F2FF', width: '30px' }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
