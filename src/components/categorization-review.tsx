import { Button, InlineNotification, Select, SelectItem, Tab, TabList, TabPanel, TabPanels, Tabs, Tile } from "@carbon/react";
import { categories } from "@/lib/categories";
import { categorizationQueue } from "@/lib/mock-data";

export function CategorizationReview() {
  return (
    <Tabs>
      <TabList aria-label="Kategorisering">
        <Tab>Til review</Tab>
        <Tab>Regler</Tab>
        <Tab>Konti</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <div className="review-grid">
            {categorizationQueue.map((item) => (
              <Tile key={item.id} className="review-card">
                <div>
                  <p className="budget-kicker">{item.account}</p>
                  <h3>{item.merchant}</h3>
                  <p>{item.text}</p>
                </div>
                <strong>{item.amount}</strong>
                <Select
                  id={`category-${item.id}`}
                  labelText="Vælg kategori"
                  defaultValue="unknown"
                >
                  <SelectItem value="unknown" text="Ukendt" />
                  {categories.map((category) => (
                    <SelectItem
                      key={category.slug}
                      value={category.slug}
                      text={category.name}
                    />
                  ))}
                </Select>
                <Button kind="tertiary" size="sm">
                  Brug som regel fremover
                </Button>
              </Tile>
            ))}
          </div>
        </TabPanel>
        <TabPanel>
          <InlineNotification
            kind="info"
            lowContrast
            title="Regelmotor"
            subtitle="Manuelle rettelser bliver senere gemt som regler baseret på modpart, tekst, konto og beløb."
          />
        </TabPanel>
        <TabPanel>
          <InlineNotification
            kind="info"
            lowContrast
            title="Konti"
            subtitle="Bankforbindelser og sync-status er synlige i overblikket, og kan senere få deres egen detaljeside."
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
