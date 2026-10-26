import { useState } from 'react'
import { ItemRow } from '../components/InventoryEditor'
import { t } from '../lib/i18n'
import { blankItem } from '../lib/inventory'
import { saveCustomItems, useCustomItems } from '../lib/itemCatalog'
import type { Item } from '../types'

/** The DM's own item list, like the custom monsters in the Bestiary: made here, picked from "My items" on a character. */
export function ItemsPage() {
  const items = useCustomItems()
  const [fresh, setFresh] = useState<string>()
  // a new item starts with a name and its details open, so the list never holds a nameless row
  const add = (item: Item) => {
    setFresh(item.id)
    void saveCustomItems([...items, item])
  }
  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('items.title')}</h2>
        <button className="primary" onClick={() => add(blankItem('gear', t('inv.newItem')))}>
          {t('inv.addItem')}
        </button>
        <button onClick={() => add({ ...blankItem('weapon', t('inv.newWeapon')), weapon: { damage: '1d6', damageType: 'slashing', proficient: true } })}>{t('inv.addWeapon')}</button>
        <button onClick={() => add({ ...blankItem('armor', t('inv.newArmor')), armor: { base: 11, dex: 'full' } })}>{t('inv.addArmor')}</button>
      </div>
      <p className="muted">{t('items.intro')}</p>
      {items.length === 0 && <p className="muted">{t('items.empty')}</p>}
      <div className="inv-list">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            startEditing={item.id === fresh}
            onChange={(p) => void saveCustomItems(items.map((i) => (i.id === item.id ? { ...i, ...p } : i)))}
            onRemove={() => (!item.name || confirm(t('items.delete', { name: item.name }))) && void saveCustomItems(items.filter((i) => i.id !== item.id))}
          />
        ))}
      </div>
    </div>
  )
}
