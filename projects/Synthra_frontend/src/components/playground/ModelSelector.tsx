import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Users, ChevronRight, Zap, Key } from 'lucide-react'
import type { AIModel, ModelCategory } from '../../types/models'
import { BASE_MODELS, COMMUNITY_AGENTS } from '../../types/models'
import APIService from '../../utils/apiservice'

interface ModelSelectorProps {
  selected: AIModel | null
  onSelect: (model: AIModel) => void
}

export default function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  const [tab, setTab] = useState<ModelCategory>('base')
  const [agents, setAgents] = useState<any[]>(COMMUNITY_AGENTS);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await getAgents();
        if (Array.isArray(data)) {
          setAgents(data);
        } else if (data?.agents) {
          setAgents(data.agents);
        }
      } catch (error) {
        console.error('failed to fetch agents ', error);
      }
    };

    fetchAgents();
  }, []);

  const getAgents = async () => {
    try{
      const response = await APIService.getAgents();
      console.log("agents", response);
      return response;
    } catch(error) {
      console.log('failed to fetch agents ', error);
    }
  }

  const models = tab === 'base' ? BASE_MODELS : agents;

  return (
    <div className="flex-shrink-0 border-b border-white/10 bg-black/20">
      <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab('base')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider transition-all duration-150 border ${
            tab === 'base'
              ? 'text-terminal-green border-terminal-green/45 bg-terminal-green/12'
              : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Base Models
        </button>

        <button
          onClick={() => setTab('community')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider transition-all duration-150 border ${
            tab === 'community'
              ? 'text-white border-white/25 bg-white/10'
              : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Community
        </button>

        <Link
          to="/api-key"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider transition-all duration-150 border border-white/10 text-gray-400 hover:text-terminal-green hover:border-terminal-green/35 hover:bg-terminal-green/10"
        >
          <Key className="w-3.5 h-3.5" />
          API Keys
        </Link>
      </div>

      <div className="flex items-stretch gap-3 px-3 sm:px-4 py-3 overflow-x-auto">
        {models.map((model) => {
          const isSelected = selected?.id === model.id
          const isCreator = model.destinationType === 'creator'

          return (
            <button
              key={model.id}
              onClick={() => onSelect(model)}
              className={`flex-shrink-0 flex flex-col gap-2 px-3.5 py-3 min-w-[210px] sm:min-w-[240px] rounded-xl border text-left transition-all duration-150 group ${
                isSelected
                  ? isCreator
                    ? 'border-white/30 bg-white/10'
                    : 'border-terminal-green/45 bg-terminal-green/12'
                  : 'border-white/10 hover:border-white/20 bg-black/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-sans font-semibold ${
                    isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  }`}
                >
                  {model.name}
                </span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    isSelected ? 'translate-x-0 opacity-100 text-terminal-green' : '-translate-x-1 opacity-0 text-gray-400'
                  }`}
                />
              </div>

              <span className="text-[12px] font-sans text-gray-400 leading-snug min-h-[34px]">
                {model.description}
              </span>

              <div className="flex items-center justify-between mt-1">
                <span
                  className={`text-[12px] font-mono font-bold ${
                    isSelected
                      ? isCreator ? 'text-white' : 'text-terminal-green'
                      : 'text-gray-400'
                  }`}
                >
                  {model.cost} ALGO / req
                </span>
                {model.creator && (
                  <span className="text-[10px] font-mono text-gray-400">
                    {model.creator}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="px-4 pb-3 text-[11px] font-mono text-gray-400 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-terminal-green" />
          Selected:
          <span className="text-white font-sans">{selected.name}</span>
          <span className="text-terminal-green">{selected.cost} ALGO</span>
        </div>
      )}
    </div>
  )
}
