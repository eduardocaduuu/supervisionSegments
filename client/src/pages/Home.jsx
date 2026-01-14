import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'

const SETORES = [
  { id: '1260', nome: 'PRATA / Palmeira / Igaci /' },
  { id: '4005', nome: 'PLATINA & OURO / Palmeira / Igaci /Major / Cacimbinhas / Estrela / Min' },
  { id: '8238', nome: 'PRATA 2 / Major / Cacimbinhas / Estrela / Quebrangulo / Minador /' },
  { id: '8239', nome: 'SUPERVISORA DE RELACIONAMENTO PALMEIRA DOS INDIOS' },
  { id: '14210', nome: 'FVC - 13706 - A - ALCINA MARIA 1' },
  { id: '16283', nome: 'FVC - 13706- BER - ALCINA MARIA' },
  { id: '16289', nome: 'FVC - 13706 - A - ALCINA MARIA 2' },
  { id: '16471', nome: 'Setor Multimarcas - PALMEIRA DOS INDIOS - CP ALCINA MARIA' },
  { id: '17539', nome: 'PLATINA / Palmeira /' },
  { id: '18787', nome: 'FVC - 13706 - ALCINA MARIA REINICIOS' },
  { id: '19699', nome: '13706 - ALCINA MARIA - SETOR DEVOLUCAO' },
  { id: '23032', nome: 'BRONZE / Todas as cidades 13706' },
  { id: '23336', nome: 'SETOR PADRAO' },
  { id: '15775', nome: 'INICIOS CENTRAL 13706' },
  { id: '1414', nome: 'SUPERVISORA DE RELACIONAMENTO' },
  { id: '1415', nome: 'PRATA 2 / Coruripe / Piacabucu / F. Deserto / Sao Sebastiao /' },
  { id: '3124', nome: 'BRONZE / Todas as cidades 13707' },
  { id: '8317', nome: 'BRONZE 2 / Todas as cidades 13707' },
  { id: '9540', nome: 'PLATINA / Penedo /' },
  { id: '14211', nome: 'FVC - 13707 - A - ALCINA MARIA 1' },
  { id: '14244', nome: 'PRATA 3 / I.Nova / Junqueiro / Olho D Agua / Porto Real / Sao Bras /' },
  { id: '14245', nome: 'PRATA 1 / Penedo /' },
  { id: '14246', nome: 'OURO / Penedo /' },
  { id: '15242', nome: 'FVC - 13707 - A - ALCINA MARIA 2' },
  { id: '15774', nome: 'INICIOS CENTRAL 13707' },
  { id: '16284', nome: 'FVC - 13707- BER - ALCINA MARIA' },
  { id: '16472', nome: 'Setor Multimarcas - PENEDO - CP ALCINA MARIA' },
  { id: '16635', nome: 'FVC - 13707 - A - ALCINA MARIA 3' },
  { id: '18788', nome: 'FVC - 13707 - ALCINA MARIA REINICIOS' },
  { id: '19698', nome: '13707 - ALCINA MARIA - SETOR DEVOLUCAO' },
  { id: '23557', nome: 'SETOR PADRAO' }
]

export default function Home() {
  const [setorId, setSetorId] = useState('')
  const [filteredSetores, setFilteredSetores] = useState(SETORES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (setorId) {
      const filtered = SETORES.filter(s =>
        s.id.includes(setorId) || s.nome.toLowerCase().includes(setorId.toLowerCase())
      )
      setFilteredSetores(filtered)
    } else {
      setFilteredSetores(SETORES)
    }
  }, [setorId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!setorId.trim()) {
      setError('Digite o codigo do setor')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Verify if setor exists
      await api.getDashboard(setorId.trim())
      navigate(`/dashboard/${setorId.trim()}`)
    } catch (err) {
      setError(err.message || 'Setor nao encontrado ou sem dados disponiveis')
    } finally {
      setLoading(false)
    }
  }

  const handleSetorClick = (id) => {
    setSetorId(id)
    navigate(`/dashboard/${id}`)
  }

  return (
    <div className="home-container">
      <h2>Bem-vinda, Supervisora!</h2>
      <p>
        Digite o codigo do seu setor para visualizar o dashboard de metas e progresso dos seus revendedores.
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px' }}>
        <div className="setor-input-group">
          <input
            type="text"
            className="form-input"
            placeholder="Digite o codigo do setor (ex: 14210)"
            value={setorId}
            onChange={(e) => setSetorId(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Acessar'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
      </form>

      <div className="setor-suggestions">
        <h4>Setores disponiveis ({filteredSetores.length})</h4>
        <div className="setor-list">
          {filteredSetores.map(setor => (
            <div
              key={setor.id}
              className="setor-item"
              onClick={() => handleSetorClick(setor.id)}
            >
              <div className="id">{setor.id}</div>
              <div className="nome">{setor.nome}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
