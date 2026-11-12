import { afterEach,it,expect,vi } from 'vitest';
import { ServerCoach,type CoachRequest } from './coach';
afterEach(()=>vi.unstubAllGlobals());
it('muestra errores de red en español y permite conservar la ayuda local',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
 await expect(new ServerCoach().explain({} as CoachRequest)).rejects.toThrow('No se pudo conectar con el entrenador.');
 await expect(new ServerCoach().unlock('prueba')).rejects.toThrow('Puedes seguir usando Stockfish.');
});
it('respeta la cancelación del consumidor sin iniciar reintentos',async()=>{
 const abort=new AbortController();abort.abort();const error=new DOMException('Aborted','AbortError');const request=vi.fn().mockRejectedValue(error);vi.stubGlobal('fetch',request);
 await expect(new ServerCoach().explain({} as CoachRequest,abort.signal)).rejects.toBe(error);expect(request).toHaveBeenCalledTimes(1);
});
