import type { Schema, Struct } from '@strapi/strapi';

export interface AvoidingImpactsAvoidingImpacts extends Struct.ComponentSchema {
  collectionName: 'components_avoiding_impacts_avoiding_impacts';
  info: {
    description: '';
    displayName: 'AvoidingImpacts';
    icon: 'allergies';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    ExplorerUrl: Schema.Attribute.Text;
    Indicators: Schema.Attribute.Component<'avoiding-impacts.indicator', true>;
    StudyLocations: Schema.Attribute.Component<'avoiding-impacts.study-location', true>;
    Title: Schema.Attribute.String;
  };
}

export interface AvoidingImpactsIndicator extends Struct.ComponentSchema {
  collectionName: 'components_avoiding_impacts_indicators';
  info: {
    displayName: 'Indicator';
    icon: 'bars';
  };
  attributes: {
    Instance: Schema.Attribute.String & Schema.Attribute.Required;
    Uid: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface AvoidingImpactsStudyLocation extends Struct.ComponentSchema {
  collectionName: 'components_avoiding_impacts_study_locations';
  info: {
    displayName: 'StudyLocation';
    icon: 'map';
  };
  attributes: {
    Uid: Schema.Attribute.String;
  };
}

export interface CaseStudyCoveredGeography extends Struct.ComponentSchema {
  collectionName: 'components_case_study_covered_geographies';
  info: {
    displayName: 'Covered Geography';
    icon: 'earth';
  };
  attributes: {
    GeographyId: Schema.Attribute.String;
  };
}

export interface DataProcessingDataProcessing extends Struct.ComponentSchema {
  collectionName: 'components_data_processing_data_processings';
  info: {
    displayName: 'DataProcessing';
    icon: 'bars';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    Label: Schema.Attribute.String;
    Title: Schema.Attribute.String;
  };
}

export interface FutureImpactsFutureImpacts extends Struct.ComponentSchema {
  collectionName: 'components_future_impacts_future_impacts';
  info: {
    description: '';
    displayName: 'FutureImpacts';
    icon: 'asterisk';
  };
  attributes: {
    ExplorerUrl: Schema.Attribute.Text;
    ImpactGeoDescription: Schema.Attribute.RichText;
    ImpactGeoSnapshot: Schema.Attribute.Component<'future-impacts.impact-geo', true>;
    ImpactTimeDescription: Schema.Attribute.RichText;
    ImpactTimeSnapshot: Schema.Attribute.Component<'future-impacts.impact-time-snapshot', true>;
  };
}

export interface FutureImpactsImpactGeo extends Struct.ComponentSchema {
  collectionName: 'components_impacts_galery_impact_geos';
  info: {
    description: '';
    displayName: 'ImpactGeoSnapshot';
    icon: 'map';
  };
  attributes: {
    Image: Schema.Attribute.Media<'images'>;
    Indicator: Schema.Attribute.String & Schema.Attribute.Required;
    Instance: Schema.Attribute.String & Schema.Attribute.Required;
    Year: Schema.Attribute.String;
  };
}

export interface FutureImpactsImpactTimeSnapshot extends Struct.ComponentSchema {
  collectionName: 'components_impacts_galery_impact_time_snapshots';
  info: {
    description: '';
    displayName: 'ImpactTimeSnapshot';
    icon: 'chart-line';
  };
  attributes: {
    Image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    Indicator: Schema.Attribute.String & Schema.Attribute.Required;
    Instance: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ImageSliderImageSlider extends Struct.ComponentSchema {
  collectionName: 'components_image_slider_image_sliders';
  info: {
    description: '';
    displayName: 'ImageSlider';
    icon: 'images';
  };
  attributes: {
    AllowImageSelection: Schema.Attribute.Boolean;
    AttributeLabel: Schema.Attribute.String;
    ExplorerUrl: Schema.Attribute.String;
    GroupingLabel: Schema.Attribute.String;
    ImageSliderPair: Schema.Attribute.Component<'image-slider.image-slider-pair', true>;
    ShowThumbnails: Schema.Attribute.Boolean;
  };
}

export interface ImageSliderImageSliderPair extends Struct.ComponentSchema {
  collectionName: 'components_image_slider_image_slider_pairs';
  info: {
    description: '';
    displayName: 'ImageSliderPair';
    icon: 'object-ungroup';
  };
  attributes: {
    AttributeValue: Schema.Attribute.String;
    Description: Schema.Attribute.String;
    GroupValue: Schema.Attribute.String;
    Image1: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    Image2: Schema.Attribute.Media<'images'>;
  };
}

export interface IssueIssue extends Struct.ComponentSchema {
  collectionName: 'components_issue_issues';
  info: {
    description: '';
    displayName: 'Issue';
    icon: 'tasks';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    Title: Schema.Attribute.String;
  };
}

export interface LandingProjectHighlight extends Struct.ComponentSchema {
  collectionName: 'components_landing_project_highlight_items';
  info: {
    description: 'One titled highlight in the second card.';
    displayName: 'ProjectHighlight';
    icon: 'bars';
  };
  attributes: {
    Description: Schema.Attribute.Text;
    Title: Schema.Attribute.String;
  };
}

export interface LandingProjectHighlights extends Struct.ComponentSchema {
  collectionName: 'components_landing_project_highlights';
  info: {
    description: 'The second card of the landing "About the project" block: an intro line, the titled highlights beneath it, and an optional link.';
    displayName: 'ProjectHighlights';
    icon: 'bulletList';
  };
  attributes: {
    Items: Schema.Attribute.Component<'landing.project-highlight', true>;
    LinkLabel: Schema.Attribute.String;
    LinkUrl: Schema.Attribute.String;
    Text: Schema.Attribute.RichText;
  };
}

export interface LandingProjectIntro extends Struct.ComponentSchema {
  collectionName: 'components_landing_project_intros';
  info: {
    description: 'The first card of the landing "About the project" block: a paragraph about the projects behind the platform, plus an optional link.';
    displayName: 'ProjectIntro';
    icon: 'align-center';
  };
  attributes: {
    LinkLabel: Schema.Attribute.String;
    LinkUrl: Schema.Attribute.String;
    Text: Schema.Attribute.RichText;
  };
}

export interface MediaPublication extends Struct.ComponentSchema {
  collectionName: 'components_media_publications';
  info: {
    displayName: 'Publication';
    icon: 'file-contract';
  };
  attributes: {
    File: Schema.Attribute.Media<'files'>;
    PublicationDate: Schema.Attribute.Date;
    Type: Schema.Attribute.Enumeration<['publication', 'deliverable']> & Schema.Attribute.DefaultTo<'publication'>;
  };
}

export interface MethodologyDataTypeDataType extends Struct.ComponentSchema {
  collectionName: 'components_methodology_data_type_data_types';
  info: {
    description: '';
    displayName: 'Data Type';
    icon: 'apps';
  };
  attributes: {
    Label: Schema.Attribute.String;
    Model: Schema.Attribute.Component<'methodology-model.model', true>;
    Processing: Schema.Attribute.Component<'methodology-processing.processing', true>;
    Simulation: Schema.Attribute.Component<'methodology-simulation.simulation', true>;
  };
}

export interface MethodologyImpactImpactSection extends Struct.ComponentSchema {
  collectionName: 'components_methodology_impact_impact_sections';
  info: {
    description: 'A section within the methodology Impact tab, grouped by Impact and Category.';
    displayName: 'Impact Section';
    icon: 'layer';
  };
  attributes: {
    Category: Schema.Attribute.String;
    Impact: Schema.Attribute.String;
    Text: Schema.Attribute.RichText;
    Title: Schema.Attribute.String;
  };
}

export interface MethodologyModelModel extends Struct.ComponentSchema {
  collectionName: 'components_methodology_model_models';
  info: {
    description: '';
    displayName: 'Model';
    icon: 'connector';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    Label: Schema.Attribute.String;
    TitleShort: Schema.Attribute.String;
  };
}

export interface MethodologyProcessingProcessing extends Struct.ComponentSchema {
  collectionName: 'components_methodology_processing_processings';
  info: {
    description: '';
    displayName: 'Processing';
    icon: 'cog';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    Label: Schema.Attribute.String;
    TitleShort: Schema.Attribute.String;
  };
}

export interface MethodologySimulationSimulation extends Struct.ComponentSchema {
  collectionName: 'components_methodology_simulation_simulations';
  info: {
    description: '';
    displayName: 'Simulation';
    icon: 'connector';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    Label: Schema.Attribute.String;
    TitleShort: Schema.Attribute.String;
  };
}

export interface ModelModel extends Struct.ComponentSchema {
  collectionName: 'components_model_models';
  info: {
    description: '';
    displayName: 'Model';
    icon: 'align-left';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    Label: Schema.Attribute.String;
    Link: Schema.Attribute.String;
    Title: Schema.Attribute.String;
    UID: Schema.Attribute.String;
  };
}

export interface ScenarioCharacteristicScenarioCharacteristic extends Struct.ComponentSchema {
  collectionName: 'components_scenario_characteristic_scenario_characteristics';
  info: {
    description: '';
    displayName: 'ScenarioCharacteristic';
    icon: 'barcode';
  };
  attributes: {
    Description: Schema.Attribute.Text;
    Year: Schema.Attribute.String;
  };
}

export interface ScenarioUidScenario extends Struct.ComponentSchema {
  collectionName: 'components_scenario_uid_scenarios';
  info: {
    displayName: 'Scenario';
    icon: 'align-right';
  };
  attributes: {
    UID: Schema.Attribute.String;
  };
}

export interface ScenarioScenario extends Struct.ComponentSchema {
  collectionName: 'components_scenario_scenarios';
  info: {
    description: '';
    displayName: 'Scenario';
    icon: 'align-justify';
  };
  attributes: {
    Description: Schema.Attribute.RichText;
    Label: Schema.Attribute.String;
    Title: Schema.Attribute.String;
    UID: Schema.Attribute.String;
  };
}

export interface SectionSection extends Struct.ComponentSchema {
  collectionName: 'components_section_sections';
  info: {
    description: '';
    displayName: 'Section';
    icon: 'align-center';
  };
  attributes: {
    Text: Schema.Attribute.RichText;
    Title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'avoiding-impacts.avoiding-impacts': AvoidingImpactsAvoidingImpacts;
      'avoiding-impacts.indicator': AvoidingImpactsIndicator;
      'avoiding-impacts.study-location': AvoidingImpactsStudyLocation;
      'case-study.covered-geography': CaseStudyCoveredGeography;
      'data-processing.data-processing': DataProcessingDataProcessing;
      'future-impacts.future-impacts': FutureImpactsFutureImpacts;
      'future-impacts.impact-geo': FutureImpactsImpactGeo;
      'future-impacts.impact-time-snapshot': FutureImpactsImpactTimeSnapshot;
      'image-slider.image-slider': ImageSliderImageSlider;
      'image-slider.image-slider-pair': ImageSliderImageSliderPair;
      'issue.issue': IssueIssue;
      'landing.project-highlight': LandingProjectHighlight;
      'landing.project-highlights': LandingProjectHighlights;
      'landing.project-intro': LandingProjectIntro;
      'media.publication': MediaPublication;
      'methodology-data-type.data-type': MethodologyDataTypeDataType;
      'methodology-impact.impact-section': MethodologyImpactImpactSection;
      'methodology-model.model': MethodologyModelModel;
      'methodology-processing.processing': MethodologyProcessingProcessing;
      'methodology-simulation.simulation': MethodologySimulationSimulation;
      'model.model': ModelModel;
      'scenario-characteristic.scenario-characteristic': ScenarioCharacteristicScenarioCharacteristic;
      'scenario-uid.scenario': ScenarioUidScenario;
      'scenario.scenario': ScenarioScenario;
      'section.section': SectionSection;
    }
  }
}
